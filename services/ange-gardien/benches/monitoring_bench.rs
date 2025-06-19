use criterion::{black_box, criterion_group, criterion_main, Criterion};
use ange_gardien::{AngeGardien, SystemState, NetworkStats};
use tokio::runtime::Runtime;
use chrono::Utc;

fn monitoring_benchmark(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let guardian = rt.block_on(async {
        AngeGardien::new().await.unwrap()
    });

    c.bench_function("system_state_update", |b| {
        b.iter(|| {
            rt.block_on(async {
                let state = guardian.get_current_state().await.unwrap();
                black_box(state);
            });
        });
    });

    c.bench_function("process_monitoring", |b| {
        b.iter(|| {
            rt.block_on(async {
                let state = guardian.get_current_state().await.unwrap();
                black_box(state.active_processes);
            });
        });
    });

    c.bench_function("network_monitoring", |b| {
        b.iter(|| {
            rt.block_on(async {
                let state = guardian.get_current_state().await.unwrap();
                black_box(state.network_stats);
            });
        });
    });
}

criterion_group!(benches, monitoring_benchmark);
criterion_main!(benches); 