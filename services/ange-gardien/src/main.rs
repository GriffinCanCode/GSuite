use ange_gardien::AngeGardien;
use clap::Parser;
use log::{info, error};
use std::path::PathBuf;
use anyhow::Result;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Path to configuration file
    #[arg(short, long, value_name = "FILE")]
    config: Option<PathBuf>,

    /// Run in debug mode
    #[arg(short, long)]
    debug: bool,

    /// Specify log level (error, warn, info, debug, trace)
    #[arg(short, long, default_value = "info")]
    log_level: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    // Initialize logging
    env_logger::Builder::from_env(env_logger::Env::default())
        .filter_level(args.log_level.parse().unwrap_or(log::LevelFilter::Info))
        .init();

    info!("Starting Ange Gardien monitoring system...");

    // Create and start the guardian
    let guardian = AngeGardien::new().await?;
    guardian.start().await?;

    // Keep the main thread running
    tokio::signal::ctrl_c().await?;
    info!("Shutting down Ange Gardien...");

    Ok(())
}
