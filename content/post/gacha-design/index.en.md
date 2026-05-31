---
title: KDays Minigame Gacha System Design
description: Notes on designing a gacha system with a gRPC interface in Rust
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
> This article was translated by GPT 5.5.

> A few days ago, while I had some free time, I tried designing a gacha system for KDays' new minigame. After looking into it carefully, I found that efficient gacha design with a guarantee system is actually quite special, so I am recording it here.

## Core Algorithm

This part references [a balanced tree's Genshin Impact gacha mechanism](https://www.bilibili.com/read/cv10468091/). Based on the given parameters, the following mechanism can be obtained:

- 1-star 76.5%  2-star 21.5%  3-star (non-limited) 1.65%  3-star (current limited) 0.35%
- The guarantee, or spark, count is 150 pulls. That is, if there is still no hit by the 150th pull, the guarantee is added to that pull sequence. Under normal circumstances, the probability should rise quickly near around 150 pulls, so it usually should not get stuck exactly at 150 pulls.

Using a roulette-wheel form, define $W_{ceil} = 10000$. Let $i$ be the number of pulls since the last 3-star appeared, and $j$ be the number of pulls since the last 4-star appeared. The weights are shown below.  
$$
\\begin{aligned}
W_\\text{3-star (limited + non-limited)}[i]&=
\\left\\{
\\begin{array}{ll}
200&(i\\leq125)\\\\
200+392\\cdot(i-125)&(i\\geq126)
\\end{array}
\\right.\\\\
W_\\text{2-star}[j]&=
\\left\\{
\\begin{array}{ll}
2150&(j\\leq8)\\\\
2150+3925\\cdot(j-8)&(j\\geq9)
\\end{array}\\right.\\\\
W_\\text{1-star}&=7650
\\end{aligned}
$$

From this, a calculation function with O(1) time complexity, while also considering the guarantee mechanism, can be constructed.

{{% details summary="Gacha probability calculation function" %}}

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

{{% /details %}}

## gRPC Service
A common choice for building a gRPC Server/Client in Rust is Tonic. Tonic is asynchronous, while our database connection should be a singleton, so this needs a bit of handling.
```rust
struct GRPCServer {
    pub storage: GachaStorage,
    pub gacha_pools: GachaPoolMap,
}
```
The section above is described in detail in Tonic's documentation, so I will not expand on it here. The main point below is the problem of atomic and linear processing for a single user's business logic.
This problem might never be triggered if database writes are fast enough, but leaving it there is still a hidden risk, so a lock-within-a-lock needs to be constructed.
```rust
pub struct GachaStorage {
    /// Database connection string
    // database_connection_string: String,
    pub database_connection: Option<DatabaseConnection>,
    /// Transaction lock
    /// Key: uid
    /// Value: whether it is in use
    pub transaction_locks: Arc<Mutex<HashMap<u32, Arc<Mutex<bool>>>>>,
}
```
Each time the gacha business logic is handled, first acquire the outer lock, then obtain the inner `Arc<Mutex<bool>>`. After that, lock the corresponding UID to ensure that the next gacha request will not be triggered before the current gacha result is written.
The business processing code is as follows:

{{% details summary="Business processing code" %}}

```rust
let transaction_locks = Arc::clone(&self.storage.transaction_locks);
let request = request.into_inner();
let uid = request.uid;
let target_pool_id = request.pool_id;

// Check whether the corresponding transaction lock already exists
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
// Wait to acquire the lock
let mut wait_lock = wait_lock.lock();
*wait_lock = true;
```

{{% /details %}}
This ensures that after the previous gacha is completed, the next gacha will not run before the new guarantee data has been written to the database, avoiding a data hazard. The rest is ordinary business logic processing, and some highly repetitive parts are omitted below.

{{% details summary="Complete business logic" %}}

```rust
 let tx = conn
     .begin_with_config(
         Some(sea_orm::IsolationLevel::ReadCommitted),
         Some(sea_orm::AccessMode::ReadOnly),
     )
     .await
     .expect("Failed to begin transaction");

 // Get the current guarantee counts
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

 // Generate the gacha pool
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
        // Similar to the above
     }
     3 => {
        // Similar to the above
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

{{% /details %}}
The above is the core business logic. The rest, such as database insertion handling and configuration file loading and parsing, will not be repeated here.
Overall, the core roulette-wheel guarantee handling method is quite clever. It avoids high-complexity loop-based judgment logic and is simple and effective.
