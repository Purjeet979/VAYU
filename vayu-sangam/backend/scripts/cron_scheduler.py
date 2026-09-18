import sys
import time
import schedule
import logging
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

def fetch_cpcb_job():
    logger.info("Executing scheduled CPCB fetch job...")
    script_path = BASE_DIR / "fetchers" / "fetch_cpcb.py"
    streak_file = BASE_DIR / "data" / "live" / "failed_streak.txt"
    alert_file = BASE_DIR / "data" / "live" / "CRITICAL_ALERT.txt"
    try:
        subprocess.run([sys.executable, str(script_path)], check=True)
        logger.info("Scheduled CPCB fetch job completed successfully.")
        
        # Reset alerts on success
        if alert_file.exists(): alert_file.unlink()
        if streak_file.exists(): streak_file.unlink()
        
        # Rolling window cleanup (Drops > 48h data automatically)
        from scripts.cpcb_history_store import cleanup_old_history
        cleanup_old_history(max_hours=48)
        
    except subprocess.CalledProcessError as e:
        logger.error(f"[ERROR] FETCH CYCLE FAILED: CPCB fetch job failed with exit code {e.returncode}")
        
        # Track failures
        failures = 0
        if streak_file.exists():
            try:
                failures = int(streak_file.read_text().strip())
            except ValueError:
                pass
        failures += 1
        
        # Ensure directories exist
        streak_file.parent.mkdir(parents=True, exist_ok=True)
        streak_file.write_text(str(failures))
        
        if failures >= 3:
            alert_file.write_text(f"CRITICAL ALERT: CPCB fetch failed {failures} times consecutively! Check network/API quotas.")
            logger.error(f"CRITICAL ALERT written: {failures} consecutive failures.")

def fetch_weather_job():
    logger.info("Executing scheduled Weather (Open-Meteo) fetch job (Phase 1)...")
    script_path = BASE_DIR / "fetchers" / "fetch_weather.py"
    try:
        subprocess.run([sys.executable, str(script_path)], check=True)
        logger.info("Scheduled Weather fetch job completed successfully.")
    except subprocess.CalledProcessError as e:
        logger.error(f"Scheduled Weather fetch job failed with exit code {e.returncode}")

def fetch_aod_job():
    logger.info("Executing scheduled MODIS AOD fetch job (Phase 5)...")
    script_path = BASE_DIR / "fetchers" / "fetch_aod.py"
    try:
        subprocess.run([sys.executable, str(script_path)], check=True)
        logger.info("Scheduled AOD fetch job completed successfully.")
    except subprocess.CalledProcessError as e:
        logger.error(f"Scheduled AOD fetch job failed with exit code {e.returncode}")

def fetch_hcho_job():
    logger.info("Executing scheduled Sentinel-5P HCHO fetch job (Phase 5)...")
    script_path = BASE_DIR / "fetchers" / "fetch_hcho.py"
    try:
        subprocess.run([sys.executable, str(script_path)], check=True)
        logger.info("Scheduled HCHO fetch job completed successfully.")
    except subprocess.CalledProcessError as e:
        logger.error(f"Scheduled HCHO fetch job failed with exit code {e.returncode}")

def main():
    logger.info("Starting VayuSangam Background Scheduler...")
    
    # Schedule jobs
    schedule.every(15).minutes.do(fetch_cpcb_job)
    schedule.every(6).hours.do(fetch_weather_job)
    schedule.every(12).hours.do(fetch_aod_job)
    schedule.every(12).hours.do(fetch_hcho_job)
    
    # Initial run on startup
    fetch_cpcb_job()
    fetch_weather_job()
    fetch_aod_job()
    fetch_hcho_job()
    
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    main()
