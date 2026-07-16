#!/usr/bin/env bash
# scripts/prod_db_seed.sh
# Safely whitelist your IP, seed the AWS RDS database, and revoke access.
set -e

PROJECT_NAME="phygitron360"
REGION="us-east-1"
DB_SG_NAME="${PROJECT_NAME}-db-sg"

echo "Checking environment variables..."
if [ -z "$DB_HOST" ] || [ -z "$DB_PASSWORD" ]; then
    echo "ERROR: You must export DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, SUPERADMIN_EMAIL, and SUPERADMIN_PASSWORD before running this script."
    echo "Example: export DB_HOST=terraform-output-endpoint.rds.amazonaws.com"
    exit 1
fi

echo "Getting your public IP..."
MY_IP=$(curl -s https://checkip.amazonaws.com)
if [ -z "$MY_IP" ]; then
    echo "ERROR: Could not determine your public IP."
    exit 1
fi
echo "Your IP is $MY_IP"

echo "Finding DB Security Group ID for $DB_SG_NAME in $REGION..."
SG_ID=$(aws ec2 describe-security-groups --filters Name=group-name,Values=$DB_SG_NAME --region $REGION --query "SecurityGroups[0].GroupId" --output text 2>/dev/null)

if [ "$SG_ID" == "None" ] || [ -z "$SG_ID" ]; then
    echo "ERROR: Could not find security group $DB_SG_NAME. Is the AWS CLI configured?"
    exit 1
fi
echo "Found DB Security Group: $SG_ID"

echo "--------------------------------------------------------"
echo "Authorizing inbound traffic on port 5432 for $MY_IP/32..."
aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 5432 \
    --cidr $MY_IP/32 \
    --region $REGION || echo "IP might already be whitelisted, continuing..."

echo "--------------------------------------------------------"
echo "Running Database Initialisation & Seeding scripts..."

# Activate python environment if available
if [ -f "backend/venv/bin/activate" ]; then
    source backend/venv/bin/activate
fi

# 1. Create tables
python -c "import sys, os; sys.path.insert(0, os.getcwd()); from backend.core.database import create_tables; create_tables(schema_name='public')"
echo "Tables created."

# 2. Run Superadmin script
python scripts/create_superadmin.py "$SUPERADMIN_EMAIL" "$SUPERADMIN_PASSWORD"
echo "Superadmin created."

# 3. Seed Permissions
python scripts/seed_permissions.py
echo "Permissions seeded."

echo "--------------------------------------------------------"
echo "Revoking inbound traffic for $MY_IP/32..."
aws ec2 revoke-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 5432 \
    --cidr $MY_IP/32 \
    --region $REGION

echo "Done! The production database is seeded and secured."
