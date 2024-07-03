---
title: KDays小游戏抽卡系统设计
description: 记录下使用Rust设计一个带GRPC接口的抽卡系统
slug: gacha-design
date: 2024-06-23 00:00:00+0000
image: cover.jpg
categories:
    - dev
tags:
    - dev
    - game
    - gacha
    - rust
    - grpc
---

> 前几日空闲时尝试给KDays新的小游戏设计了一套抽卡系统，仔细研究的时候发现考虑保底情况下的高效抽卡设计起来还挺特别的，在此做一份记录

## 核心算法

此处参考了[一颗平衡树的原神抽卡机制](https://www.bilibili.com/read/cv10468091/)，再根据给定的参数可以得到以下机制：

- 1星76.5%  2星21.5%  3星（非限定）1.65%  3星（当期限定）0.35%
- 保底（井）数为150抽，即第150抽仍未出货的则在那次抽卡序列增加保底（正常情况下应该接近150抽左右时，概率应该快速上升，一般不会卡在150抽）

轮盘赌形式，规定$W_{ceil} = 10000$，$i$为从上次出现3星后的抽数，$j$表示从上次出现4星后的抽数，则有权重如下图所示  
$$
\\begin{aligned}
W_\\text{3星(限定+非限定)}[i]&=
\\left\\{
\\begin{array}{ll}
200&(i\\leq125)\\\\
200+392\\cdot(i-125)&(i\\geq126)
\\end{array}
\\right.\\\\
W_\\text{2星}[j]&=
\\left\\{
\\begin{array}{ll}
2150&(j\\leq8)\\\\
2150+3925\\cdot(j-8)&(j\\geq9)
\\end{array}\\right.\\\\
W_\\text{1星}&=7650
\\end{aligned}
$$

由此可以构建一个时间复杂度为O(1)的，同时考虑了保底机制的计算函数
```rust
fn calc_rank(&self, since_last_3star: u32, since_last_2star: u32) -> u8 {

    let mut gacha_table: Vec<u8> = Vec::with_capacity(10000);
    // 3 star
    // Must be less than 10000, no need to check for overflow
    if since_last_3star <= 125 {
        for _ in 0..200 {
            gacha_table.push(3);
        }
    } else {
        for _ in 0..(200 + 392 * (since_last_3star - 125)) {
            gacha_table.push(3);
        }
    }

    // 2 star
    if since_last_2star <= 8 {
        for _ in 0..2150 {
            if gacha_table.len() == 10000 {
                break;
            }
            gacha_table.push(2);
        }
    } else {
        for _ in 0..(2150 + 3925 * (since_last_2star - 8)) {
            if gacha_table.len() == 10000 {
                break;
            }
            gacha_table.push(2);
        }
    }

    // 1 star
    loop {
        if gacha_table.len() == 10000 {
            break;
        }
        gacha_table.push(1);
    }

    let mut rand = rand::thread_rng();
    let gacha: usize = rand.gen_range(0..10000);
    gacha_table.get(gacha).unwrap().clone()
}
```

## GRPC服务
Rust中构建GRPC Server/Client比较常用的是Tonic，Tonic是异步的，而我们的数据库连接应当是单例，此时需要稍微处理下
```rust
struct GRPCServer {
    pub storage: GachaStorage,
    pub gacha_pools: GachaPoolMap,
}
```
上述部分在Tonic的文档中有详细说明此处不详细展开了，下面主要说一下对于单用户业务原子化与线性处理的问题，
这问题由于数据库写入足够快可能永远也不会触发，但留着就是个隐患，因此需要构建一个锁中锁
```rust
pub struct GachaStorage {
    /// 数据库连接串
    // database_connection_string: String,
    pub database_connection: Option<DatabaseConnection>,
    /// 事务锁
    /// Key: uid
    /// Value: 是否被占用
    pub transaction_locks: Arc<Mutex<HashMap<u32, Arc<Mutex<bool>>>>>,
}
```
每次处理抽卡业务的时候先拿到外层锁，然后获取里面的`Arc<Mutex<bool>>`，之后将这个对应UID上锁，来确保在本次抽卡结果写入完成前不会再次触发下一次抽卡，
业务处理代码如下
```rust
let transaction_locks = Arc::clone(&self.storage.transaction_locks);
let request = request.into_inner();
let uid = request.uid;
let target_pool_id = request.pool_id;

// 检查是否已存在对应的事务锁
let wait_lock: Arc<Mutex<bool>>;
{
    let mut transaction_locks = transaction_locks.lock();
    if !transaction_locks.contains_key(&uid) {
        wait_lock = Arc::new(Mutex::new(false));
        transaction_locks.insert(uid, Arc::clone(&wait_lock));
    } else {
        wait_lock = Arc::clone(transaction_locks.get(&uid).unwrap());
    }
}
// 等待获得锁
let mut wait_lock = wait_lock.lock();
*wait_lock = true;
```
这样便可以确保不会出现上次抽卡完成后，新的保底数据未能写入数据库而产生的数据冒险问题。剩余的部分便是寻常的业务逻辑处理，下面会省略一些重复度高的部分
```rust
 let tx = conn
     .begin_with_config(
         Some(sea_orm::IsolationLevel::ReadCommitted),
         Some(sea_orm::AccessMode::ReadOnly),
     )
     .await
     .expect("Failed to begin transaction");

 // 获取到目前的保底次数
 let since_last_3star;
 let since_last_2star;
 match self.storage.get_gacha_count(uid, &tx).await {
     Ok((num1, num2)) => {
         since_last_3star = num1;
         since_last_2star = num2;
     }
     Err(_) => {
         return Ok(Response::new(GachaResponse {
             success: false,
             id: 0,
         }));
     }
 }

 // 生成卡池
 let target_pool = self.gacha_pools.get(&target_pool_id).unwrap();
 let (rank, id) = target_pool.do_gacha(since_last_3star, since_last_2star);
 match rank {
     1 => {
         let result = self
             .storage
             .update_guarantee_count(
                 uid,
                 (since_last_3star + 1, since_last_2star + 1),
                 &tx,
             )
             .await;
         if result.is_err() {
             error!("Failed to update guarantee count");
             return Ok(Response::new(GachaResponse {
                 success: false,
                 id: 0,
             }));
         }
     }
     2 => {
        // 类似上述
     }
     3 => {
        // 类似上述
     }
     _ => {
         error!("Invalid rank: {}", rank);
         return Ok(Response::new(GachaResponse {
             success: false,
             id: 0,
         }));
     }
 }
 tx.commit().await.expect("Failed to commit transaction");
 *wait_lock = false;
 Ok(Response::new(GachaResponse { success: true, id }))
```
上述为核心的业务逻辑部分，其余的如数据库插入处理，配置文件加载解析等在此不再赘述。
总体来说核心的轮盘保底处理方式十分巧妙，避免了高复杂度的循环判断逻辑，简洁有效。