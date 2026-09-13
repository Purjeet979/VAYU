import time
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

from .fetch_firms import fetch_firms_data
# from .fetch_cpcb import fetch_cpcb_data
# from .fetch_weather import fetch_weather_data
# from .fetch_hcho import fetch_hcho_data

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger('run_all')

def main():
    load_dotenv()
    
    scheduler = BackgroundScheduler()
    
    # Schedule Phase 1: FIRMS (every 3 hours)
    scheduler.add_job(fetch_firms_data, 'interval', hours=3, id='fetch_firms')
    
    # Phase 2: CPCB (every 1 hour)
    # scheduler.add_job(fetch_cpcb_data, 'interval', hours=1, id='fetch_cpcb')
    
    # Phase 3: Weather (every 6 hours)
    # scheduler.add_job(fetch_weather_data, 'interval', hours=6, id='fetch_weather')
    
    # Phase 4: HCHO (every 12 hours)
    # scheduler.add_job(fetch_hcho_data, 'interval', hours=12, id='fetch_hcho')
    
    scheduler.start()
    logger.info("VayuSangam Data Fetcher Scheduler started. Press Ctrl+C to exit.")
    
    # Initial run for all immediately on startup
    logger.info("Triggering initial data fetches...")
    fetch_firms_data()
    
    try:
        # Keep the main thread alive
        while True:
            time.sleep(2)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        logger.info("Scheduler shut down successfully.")

if __name__ == "__main__":
    main()
