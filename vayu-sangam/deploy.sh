#!/bin/bash
set -e

echo "Setting up Python environment..."
cd /home/ubuntu
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip --no-cache-dir
rm -rf ~/.cache/pip
pip install --no-cache-dir -r requirements.txt
pip install --no-cache-dir schedule xgboost scikit-learn

echo "Creating vayu-cron.service..."
cat << 'EOF' | sudo tee /etc/systemd/system/vayu-cron.service
[Unit]
Description=VayuSangam Data Fetcher Cron
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu
Environment="PATH=/home/ubuntu/venv/bin:$PATH"
ExecStart=/home/ubuntu/venv/bin/python -u backend/scripts/cron_scheduler.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "Creating vayu-backend.service..."
cat << 'EOF' | sudo tee /etc/systemd/system/vayu-backend.service
[Unit]
Description=VayuSangam FastAPI Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu
Environment="PATH=/home/ubuntu/venv/bin:$PATH"
ExecStart=/home/ubuntu/venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd and starting services..."
sudo systemctl daemon-reload
sudo systemctl enable vayu-cron
sudo systemctl enable vayu-backend
sudo systemctl restart vayu-cron
sudo systemctl restart vayu-backend

echo "Deployment complete. Services are running."
sudo systemctl status vayu-cron --no-pager
sudo systemctl status vayu-backend --no-pager
