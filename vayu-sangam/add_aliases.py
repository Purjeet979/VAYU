import pandas as pd

aliases = [
    ("site_1423", "ITI Jahangirpuri, Delhi, Delhi, India", "jahangirpuri", "Delhi"),
    ("site_1430", "Shaheed Sukhdev College of Business Studies, Rohini, Delhi, Delhi, India", "rohini", "Delhi"),
    ("site_1428", "DITE Okhla, Delhi, Delhi, India", "okhla phase-2", "Delhi"),
    ("site_1562", "Sri Auribindo Marg, Delhi, Delhi, India", "sri aurobindo marg", "Delhi"),
    ("site_1432", "Sonia Vihar Water Treatment Plant DJB, Delhi, Delhi, India", "sonia vihar", "Delhi"),
    ("site_1560", "Pooth Khurd, Bawana, Delhi, Delhi, India", "bawana", "Delhi"),
    ("site_124", "R.K. Puram, Delhi, Delhi, India", "r k puram", "Delhi"),
    ("site_1429", "PGDAV College, Sriniwaspuri, Delhi, Delhi, India", "sriniwaspuri", "Delhi"),
    ("site_1435", "ITI Shahdra, Jhilmil Industrial Area, Delhi, Delhi, India", "jhilmil", "Delhi"),
    ("site_1434", "Delhi Institute of Tool Engineering, Wazirpur, Delhi, Delhi, India", "wazirpur", "Delhi"),
    ("site_1422", "National Institute of Malaria Research, Sector 8, Dwarka, Delhi, Delhi, India", "dwarka", "Delhi"),
    ("site_1420", "Satyawati College, Delhi, Delhi, India", "ashok vihar", "Delhi"),
    ("site_1431", "Mother Dairy Plant, Parparganj, Delhi, Delhi, India", "patparganj", "Delhi"),
    ("site_1427", "Bramprakash Ayurvedic Hospital, Najafgarh, Delhi, Delhi, India", "najafgarh", "Delhi")
]

df = pd.read_csv("backend/data/cpcb_stations.csv")

new_rows = []
for station_id, station_name, clean_name, city in aliases:
    new_rows.append({
        "station_id": station_id,
        "station_name": station_name,
        "clean_name": clean_name,
        "address": "WAQI Alias",
        "latitude": 0.0,
        "longitude": 0.0,
        "city": city,
        "state": "Delhi"
    })

df = pd.concat([df, pd.DataFrame(new_rows)], ignore_index=True)
df.to_csv("backend/data/cpcb_stations.csv", index=False)
print("Aliases added.")
