---
title: 初试Rust Burn训练模型
description: 记录一下首次尝试用Rust与Burn框架完成一个简单时间序列预测Transformer的训练
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

> 最近折腾基于Python的人工智能相关的项目比较多，Python写起来是快，但是这个项目的可移植性可谓是聊胜于无，尤其包管理器pip难用的离谱，所以当需要自己写模型的时候果断放弃Python，
> 换了Rust来写，Rust基础的机器学习库比较完善的有HuggingFace开源的Candle，但是Candle更偏向底层，并不能像Pytorch那样提供一些现有的层，比如Transformer、LSTM等，
> 同时再考虑到推理、训练的后端可移植性，切换到了一个比较新的Burn框架上。  
> Burn本身不提供算子核心，它依赖于Candle或者WGPU来提供后端AutoGrad，因此作为一个高度抽象的API能够保持良好的可移植性，同时Burn提供了一些内置的层，包括但不限于LSTM、Transformer Encoder等，
> 本文只是一些简单的踩坑，总体来说还是很看好基于Rust的人工智能训练与推理的未来。

## 数据加载
首先需要写一个struct来作为输入的原子数据(大概这个意思)，同时我们需要自定义一个反序列化函数来把字符串类型的时间变为UNIX时间戳来方便transformer理解
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

由于任务是时间序列预测，需要输入10个时刻数据，输出下一个时刻的数据，因此搞一个type
```rust
pub type SatelliteStatusTimeSeriesData = [SatelliteStatus; 11];
```

之后需要实现Burn的数据集接口，因此需要一个
```rust
pub struct SatelliteStatusTimeSeriesDataset {
    pub dataset: InMemDataset<SatelliteStatusTimeSeriesData>,
}
```
在这个任务里由于数据量较少没有进行二进制数据缓存的处理，虽然加载略慢但是问题不大，如果数据量更大的话其实最好是从CSV或JSON等读取并处理完数据后再进行二进制缓存  
然后需要实现数据集的加载函数，按照时间序列搞一个滑动窗口，每次取11个时刻的数据，前10个作为输入，最后一个作为输出
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
为了能够让Burn的训练器自动读取，需要实现`Dataset` trait
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

## 数据Batch预处理
在此需要实现真正用于训练的Batch，包括输入与输出，因此先定义一个Batch的struct
```rust
#[derive(Clone, Debug)]
pub struct SatelliteStatusBatch<B: Backend> {
    // [batch_size, time_length(10), input_datas]
    pub source: Tensor<B, 3>,
    // [batch_size, target_datas]
    pub target: Tensor<B, 2>,
}
```
还需要一个Batcher的struct，来实现具体的功能
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

在这之后是最关键的，连接数据集与Batch的函数，这里需要实现`Batcher` trait
```rust
impl<B: Backend> Batcher<数据集, Batch<B>>
    for Batcher<B>
```
然后在实现的`batch`函数里来处理数据，注意此时的`SatelliteStatusBatch`为后面训练用的`TrainConfig`里的`batch_size`个Batch，  
也就是说，每一个数据的source应当是`time_length(10) * input_datas`这个二维Tensor，但是要乘一个`batch_size`因而变为了三维的Tensor
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
处理的时候务必要注意数据的归一化处理，不然会导致梯度爆炸或者梯度消失，此处由于是一个Demo因而直接采用magic number了

## 模型编写
那么首先呢我们需要先定义模型的结构，这点和Pytorch中的处理很像  
此处是先用PositionalEncoding添加时间序列参数，不然的话transformer不会考虑数据的先后顺序问题；再使用标准encoder后用一个线性层做decoder
```rust
#[derive(Module, Debug)]
pub struct SatelliteStatusPredictor<B: Backend> {
    positional_encoding: PositionalEncoding<B>,
    encoder: TransformerEncoder<B>,
    decoder: Linear<B>,
}
```
务必注意要加上`Module` derive不然的话会导致AutoGrad的Backend出错  
然后要定义每一层具体的输入输出大小等详细配置
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
模型配置完成后要编写模型forward部分
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
再写一下训练的时候forward的过程，在这里应当要计算loss，Burn提供了RegressionOutput和ClassificationOutput两种不同的输出，根据自己需要选择一种即可
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
这之后其实训练过程就已经可以手动进行了，但是为了方便可以采用Burn提供的自动训练器，也很简单只需要实现两个trait即可
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

## 自动训练
Burn很贴心的给配了个控制台UI，来实时查看训练进度，很nice  
首先定义一个训练的配置struct
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
同样是注意derive不要落下  
然后可以开始配置GPU加速部分并准备训练
```rust
type MyBackend = Wgpu<AutoGraphicsApi, f32, i32>;
type MyAutodiffBackend = Autodiff<MyBackend>;
let device = burn::backend::wgpu::WgpuDevice::default();

let config = TrainConfig::new(SatelliteStatusPredictorConfig::new(), AdamConfig::new());
train::<MyAutodiffBackend>(config, device);
```
训练时候先要进一步将整个数据集切分成训练集和验证集两部分
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
完成后便可以直接扔给Burn的自动训练器来进行训练了，训练完成后保存checkpoint到指定文件即可
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
这样便可以用Burn来训练一个简单的Transformer了，当然随着模型的复杂度增大需要额外处理的部分也更多，
过段时间的话我会再写一个利用Burn将ONNX模型推理嵌入到基于Flutter的移动端APP中的文章，毕竟利用Rust的话效率要比Dart本身高上不少

> 在看四月新番，黑长直yyds啊😜，虽然是浪漫爱情故事，但是强者之间的故事总是能令人神往呢，还是得不断变强啊👾