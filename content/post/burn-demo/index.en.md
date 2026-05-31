---
title: First Attempt at Training a Model with Rust Burn
description: Notes on my first attempt to train a simple time-series prediction Transformer with Rust and the Burn framework
slug: burn-demo
date: 2024-05-05 00:00:00+0000
image: cover.jpg
categories:
    - dev
    - ai
tags:
    - dev
    - ai
---
> This article was translated by GPT 5.5.

> Recently I have been tinkering with a lot of Python-based AI projects. Python is quick to write, but the portability of these projects is barely better than nothing, especially because the `pip` package manager is absurdly painful to use. So when I needed to write a model myself, I decisively gave up on Python.
> I switched to Rust. Among Rust's relatively complete basic machine learning libraries, HuggingFace's open-source Candle is one option, but Candle is more low-level and does not provide existing layers such as Transformer or LSTM the way PyTorch does.
> At the same time, considering backend portability for inference and training, I switched to the relatively new Burn framework.  
> Burn itself does not provide operator cores; it relies on Candle or WGPU to provide the AutoGrad backend. Therefore, as a highly abstract API, it can maintain good portability. Burn also provides some built-in layers, including but not limited to LSTM and Transformer Encoder.
> This article is only a brief record of issues I ran into. Overall, I am still quite optimistic about the future of Rust-based AI training and inference.

## Data Loading
First, we need to write a struct as the atomic input data, roughly speaking. We also need to customize a deserialization function to convert string-formatted time into a UNIX timestamp so that the transformer can understand it more easily.

{{% details summary="Input data structure definition" %}}

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SatelliteStatus {
    pub name: String,
    #[serde(deserialize_with = "datetime_to_timestamp")]
    pub time: i64,
    pub range: f64,
    #[serde(rename = "SNR")]
    pub snr: f64,
    #[serde(rename = "t")]
    pub latency: f64,
    pub channel_capacity: f64,
}

fn datetime_to_timestamp<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    let dt = NaiveDateTime::parse_from_str(&s, "%d %b %Y %H:%M:%S%.3f")
        .expect("Failed to turn datetime to timestamp");
    Ok(dt.and_utc().timestamp())
}

pub fn load_satellite_status(data_path: String) -> Vec<SatelliteStatus> {
    let data = std::fs::File::open(data_path).expect("Failed to open satellite status file");
    serde_json::from_reader(data).expect("Failed to load satellite status")
}
```

{{% /details %}}

Because this task is time-series prediction, it needs to take data from 10 timestamps as input and output the data for the next timestamp. So define a type:
```rust
pub type SatelliteStatusTimeSeriesData = [SatelliteStatus; 11];
```

Next, we need to implement Burn's dataset interface, so we need:
```rust
pub struct SatelliteStatusTimeSeriesDataset {
    pub dataset: InMemDataset<SatelliteStatusTimeSeriesData>,
}
```
In this task, because the amount of data is small, I did not implement binary data caching. Loading is slightly slow, but not a serious problem. If the dataset were larger, it would be best to read and preprocess the data from CSV, JSON, or similar formats, then cache the processed data in binary form.  
Then we need to implement the dataset loading function. Following the time series, use a sliding window and take 11 timestamps each time: the first 10 as input and the last one as output.

{{% details summary="Dataset loading function" %}}

```rust
impl SatelliteStatusTimeSeriesDataset {
    pub fn new() -> anyhow::Result<Self> {
        info!("Loading satellite status");
        const DATA_PATH: &str = "./data";
        let mut statuses: Vec<SatelliteStatus> = Vec::new();
        let entries = std::fs::read_dir(DATA_PATH).expect("Failed to read data directory");
        for entry in entries {
            let entry = entry.expect("Failed to read entry");
            if entry.file_name().to_str().unwrap().ends_with("json") {
                let path = entry.path();
                let path = path.to_str().expect("Failed to convert path to string");
                let data = load_satellite_status(path.to_string());
                println!("Loaded {}", entry.file_name().to_str().unwrap());
                statuses.extend(data);
            }
        }

        let mut dataset: Vec<SatelliteStatusTimeSeriesData> =
            Vec::<SatelliteStatusTimeSeriesData>::new();
        for time_series_data in statuses.windows(11) {
            let array: SatelliteStatusTimeSeriesData =
                time_series_data.to_vec().try_into().unwrap();
            dataset.push(array);
        }
        info!("Loaded {} statuses", statuses.len());
        let dataset = InMemDataset::new(dataset);
        Ok(Self { dataset })
    }
}
```

{{% /details %}}
To let Burn's trainer read it automatically, implement the `Dataset` trait:
```rust
impl Dataset<SatelliteStatusTimeSeriesData> for SatelliteStatusTimeSeriesDataset {
    fn get(&self, index: usize) -> Option<SatelliteStatusTimeSeriesData> {
        self.dataset.get(index)
    }

    fn len(&self) -> usize {
        self.dataset.len()
    }
}
```

## Batch Data Preprocessing
Here we need to implement the actual batch used for training, including both input and output, so first define a batch struct:
```rust
#[derive(Clone, Debug)]
pub struct SatelliteStatusBatch<B: Backend> {
    // [batch_size, time_length(10), input_datas]
    pub source: Tensor<B, 3>,
    // [batch_size, target_datas]
    pub target: Tensor<B, 2>,
}
```
We also need a batcher struct to implement the concrete functionality:
```rust
#[derive(Clone)]
pub struct SatelliteStatusBatcher<B: Backend> {
    device: B::Device,
}

impl<B: Backend> SatelliteStatusBatcher<B> {
    pub fn new(device: B::Device) -> Self {
        Self { device }
    }
}
```

After that comes the most important part: the function that connects the dataset and the batch. Here we need to implement the `Batcher` trait:
```rust
impl<B: Backend> Batcher<Dataset, Batch<B>>
    for Batcher<B>
```
Then, in the implemented `batch` function, we process the data. Note that the `SatelliteStatusBatch` here contains `batch_size` batches from the `TrainConfig` used later for training.  
In other words, each data item's source should be a two-dimensional tensor of `time_length(10) * input_datas`, but after multiplying by `batch_size`, it becomes a three-dimensional tensor.

{{% details summary="Tensor construction logic" %}}

```rust
impl<B: Backend> Batcher<SatelliteStatusTimeSeriesData, SatelliteStatusBatch<B>>
    for SatelliteStatusBatcher<B>
{
    fn batch(&self, items: Vec<SatelliteStatusTimeSeriesData>) -> SatelliteStatusBatch<B> {
        let mut sources = Vec::<Tensor<B, 2>>::new();
        let mut targets = Vec::<Tensor<B, 1>>::new();

        for time_series_data in items {
            let source: Vec<Tensor<B, 1>> = time_series_data
                .iter()
                .take(10)
                .map(|item| {
                    Data::<f64, 1>::from([
                        item.range / 2732.,
                        item.snr / 33.,
                        item.latency * 10.,
                        item.channel_capacity / 162525.,
                    ])
                })
                .map(|data| Tensor::<B, 1>::from_data(data.convert(), &self.device))
                .collect();

            let mut target: Vec<Tensor<B, 1>> = time_series_data
                .iter()
                .skip(10)
                .map(|item| {
                    Data::<f64, 1>::from([
                        item.range / 2732.,
                        item.snr / 33.,
                        item.latency * 10.,
                        item.channel_capacity / 162525.,
                    ])
                })
                .map(|data| Tensor::<B, 1>::from_data(data.convert(), &self.device))
                .collect();

            let source: Tensor<B, 2> = Tensor::<B, 1>::stack(source, 0);
            let target = target.remove(0);
            sources.push(source);
            targets.push(target);
        }

        let source: Tensor<B, 3> = Tensor::<B, 2>::stack(sources, 0);
        let target: Tensor<B, 2> = Tensor::<B, 1>::stack(targets, 0);

        SatelliteStatusBatch { source, target }
    }
}
```

{{% /details %}}
When processing the data, be sure to normalize it; otherwise, it can cause gradient explosion or vanishing gradients. Since this is only a demo, I directly used magic numbers here.

## Model Implementation
First, we need to define the model structure. This is very similar to how it is handled in PyTorch.  
Here, `PositionalEncoding` is used first to add time-series parameters; otherwise, the transformer will not consider the order of the data. Then a standard encoder is used, followed by a linear layer as the decoder.
```rust
#[derive(Module, Debug)]
pub struct SatelliteStatusPredictor<B: Backend> {
    positional_encoding: PositionalEncoding<B>,
    encoder: TransformerEncoder<B>,
    decoder: Linear<B>,
}
```
Be sure to add the `Module` derive, otherwise the AutoGrad backend will fail.  
Then define the detailed configuration for each layer, such as the concrete input and output sizes:
```rust
#[derive(Config)]
pub struct SatelliteStatusPredictorConfig {}

impl SatelliteStatusPredictorConfig {
    pub fn init<B: Backend>(&self, device: &B::Device) -> SatelliteStatusPredictor<B> {
        let positional_encoding = PositionalEncodingConfig::new(4).init(device);
        let encoder = TransformerEncoderConfig::new(4, 64, 4, 4).init(device);
        let decoder = LinearConfig::new(4, 3).init(device);
        SatelliteStatusPredictor {
            positional_encoding,
            encoder,
            decoder,
        }
    }
}
```
After the model configuration is complete, write the forward part of the model:
```rust
pub fn forward(&self, source: Tensor<B, 3>) -> Tensor<B, 2> {
    let positional_encoded = self.positional_encoding.forward(source);
    let encoded = self
        .encoder
        .forward(TransformerEncoderInput::new(positional_encoded));
    let decoded = self.decoder.forward(encoded);
    let [batch_size, _, d_model] = decoded.dims();
    decoded.slice([0..batch_size, 0..1, 0..d_model]).squeeze(1)
}
```
Then write the forward process used during training. Here, the loss should be calculated. Burn provides two different output types, `RegressionOutput` and `ClassificationOutput`; choose whichever fits your needs.
```rust
pub fn forward_training(
    &self,
    source: Tensor<B, 3>,
    targets: Tensor<B, 2>,
) -> RegressionOutput<B> {
    let predicted = self.forward(source);
    let [batch_size, _] = targets.dims();
    let targets = targets.clone().slice([0..batch_size, 0..3]);
    let loss = MseLoss::new().forward(predicted.clone(), targets.clone(), Reduction::Sum);
    RegressionOutput::new(loss, predicted, targets)
}
```
At this point, the training process can already be run manually. For convenience, however, you can use Burn's automatic trainer. It is also quite simple: just implement two traits.

{{% details summary="Training trait implementations" %}}

```rust
impl<B: AutodiffBackend> TrainStep<SatelliteStatusBatch<B>, RegressionOutput<B>>
    for SatelliteStatusPredictor<B>
{
    fn step(
        &self,
        batch: SatelliteStatusBatch<B>,
    ) -> burn::train::TrainOutput<RegressionOutput<B>> {
        let item = self.forward_training(batch.source, batch.target);
        TrainOutput::new(self, item.loss.backward(), item)
    }
}

impl<B: Backend> ValidStep<SatelliteStatusBatch<B>, RegressionOutput<B>>
    for SatelliteStatusPredictor<B>
{
    fn step(&self, batch: SatelliteStatusBatch<B>) -> RegressionOutput<B> {
        self.forward_training(batch.source, batch.target)
    }
}
```

{{% /details %}}

## Automatic Training
Burn thoughtfully provides a console UI for viewing training progress in real time, which is nice.  
First, define a training config struct:
```rust
#[derive(Config)]
struct TrainConfig {
    pub model: SatelliteStatusPredictorConfig,
    pub optimizer: AdamConfig,
    #[config(default = 1.0e-2)]
    pub learning_rate: f64,
    #[config(default = 233)]
    pub seed: u64,
    #[config(default = 256)]
    pub batch_size: usize,
    #[config(default = 10)]
    pub num_epochs: usize,
}
```
Again, remember not to miss the derive.  
Then configure the GPU acceleration part and prepare for training:
```rust
type MyBackend = Wgpu<AutoGraphicsApi, f32, i32>;
type MyAutodiffBackend = Autodiff<MyBackend>;
let device = burn::backend::wgpu::WgpuDevice::default();

let config = TrainConfig::new(SatelliteStatusPredictorConfig::new(), AdamConfig::new());
train::<MyAutodiffBackend>(config, device);
```
During training, first split the full dataset into a training set and a validation set.

{{% details summary="Training/validation split and training configuration" %}}

```rust
let dataset: ShuffledDataset<SatelliteStatusTimeSeriesDataset, [data::SatelliteStatus; 11]> =
    ShuffledDataset::with_seed(
        SatelliteStatusTimeSeriesDataset::new().unwrap(),
        config.seed,
    );

let data_length = dataset.len();
let train_size = (data_length as f32 * 0.8) as usize;
let test_size = data_length - train_size;
let dataset_train: PartialDataset<
    ShuffledDataset<SatelliteStatusTimeSeriesDataset, [data::SatelliteStatus; 11]>,
    [data::SatelliteStatus; 11],
> = PartialDataset::new(dataset, 0, train_size);

let dataset: ShuffledDataset<SatelliteStatusTimeSeriesDataset, [data::SatelliteStatus; 11]> =
    ShuffledDataset::with_seed(
        SatelliteStatusTimeSeriesDataset::new().unwrap(),
        config.seed,
    );
let dataset_val: PartialDataset<
    ShuffledDataset<SatelliteStatusTimeSeriesDataset, [data::SatelliteStatus; 11]>,
    [data::SatelliteStatus; 11],
> = PartialDataset::new(dataset, train_size, train_size + test_size);
let batcher_train = SatelliteStatusBatcher::<B>::new(device.clone());
let batcher_valid = SatelliteStatusBatcher::<B::InnerBackend>::new(device.clone());
let dataloader_train = DataLoaderBuilder::new(batcher_train)
    .batch_size(config.batch_size)
    .shuffle(config.seed)
    .build(dataset_train);

let dataloader_valid = DataLoaderBuilder::new(batcher_valid)
    .batch_size(config.batch_size)
    .shuffle(config.seed)
    .build(dataset_val);
```

{{% /details %}}
After this is done, you can hand it directly to Burn's automatic trainer for training. After training completes, save the checkpoint to the specified file.
```rust
B::seed(config.seed);

let learner = LearnerBuilder::new("run")
    .metric_train_numeric(LossMetric::new())
    .metric_valid_numeric(LossMetric::new())
    .with_file_checkpointer(CompactRecorder::new())
    .devices(vec![device.clone()])
    .num_epochs(config.num_epochs)
    .summary()
    .build(
        config.model.init::<B>(&device),
        config.optimizer.init(),
        config.learning_rate,
    );
let model_trained = learner.fit(dataloader_train, dataloader_valid);
model_trained
    .save_file("run/model", &CompactRecorder::new())
    .expect("Trained model should be saved successfully");
```
With this, you can train a simple Transformer with Burn. Of course, as the model becomes more complex, more parts will need additional handling.
When I have time, I will write another article about embedding ONNX model inference with Burn into a Flutter-based mobile app. After all, Rust is much more efficient than Dart itself.

> I have been watching the April anime season; black long straight hair is the best😜. Although it is a romantic story, stories between strong people are always fascinating. I still need to keep getting stronger👾
