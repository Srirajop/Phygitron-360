# Phygitron 360 - Deployment Architecture & Operations Guide

This document details the production deployment architecture, CI/CD pipeline, and operational procedures for the Phygitron 360 platform on Amazon Web Services (AWS).

---

## 1. Architecture Overview

Phygitron 360 is deployed as a highly available, containerized microservices application on AWS. 

### Core AWS Services Used
*   **Compute:** AWS ECS (Elastic Container Service) running on **Fargate** (Serverless compute for containers).
*   **Database:** Amazon RDS (Relational Database Service) running PostgreSQL.
*   **Networking:** Amazon VPC, Public/Private Subnets, and Security Groups.
*   **Load Balancing:** AWS Application Load Balancer (ALB).
*   **Container Registry:** Amazon ECR (Elastic Container Registry).
*   **Infrastructure as Code (IaC):** HashiCorp Terraform.

### How Traffic Flows
1.  A user visits the application via the **Application Load Balancer (ALB)** URL (or custom domain).
2.  The ALB inspects the URL path:
    *   If the path starts with `/api/`, the traffic is routed to the **Backend ECS Service** (FastAPI / Python).
    *   For all other paths, traffic is routed to the **Frontend ECS Service** (React / Nginx).
3.  The Backend Service communicates securely with the **RDS PostgreSQL Database** within the VPC.

---

## 2. Infrastructure as Code (Terraform)

All AWS infrastructure is defined and managed using **Terraform** located in the `infra/terraform/` directory.

### Key Files
*   `ecs.tf`: Defines the ECS Cluster, Task Definitions (the blueprint for containers), and ECS Services. This is where environment variables (like Database passwords and API keys) are injected into the containers.
*   `network.tf`: Defines the VPC, Subnets, Internet Gateway, and Route Tables.
*   `alb.tf`: Defines the Load Balancer, Target Groups, and Routing Rules.
*   `rds.tf`: Defines the PostgreSQL database.
*   `terraform.tfvars`: A Git-ignored file stored locally on your machine that contains all sensitive production secrets (e.g., `db_password`, `smtp_pass`, `secret_key`).

### How to Apply Infrastructure Changes
If you need to change server sizes, update environment variables, or add new AWS resources:
1. Navigate to the terraform directory: `cd infra/terraform`
2. Make your changes to the `.tf` files or update secrets in `terraform.tfvars`.
3. Run `terraform plan` to preview the changes.
4. Run `terraform apply` and type `yes` to execute the changes on AWS.

> [!WARNING]
> Running `terraform apply` on the ECS Task Definitions creates a new revision on AWS, but the live ECS Service will **not** automatically restart to use it. You must either push code to trigger the GitHub Action or manually force the service to update.

---

## 3. Continuous Integration / Continuous Deployment (CI/CD)

Deployments are fully automated using **GitHub Actions**.

### The Pipeline (`.github/workflows/deploy-aws.yml`)
Whenever code is merged or pushed to the `main` branch, the GitHub Action automatically starts. 

1.  **Build:** It builds two separate Docker images (one for the `frontend`, one for the `backend`).
2.  **Tag:** It tags the images with the unique Git commit hash.
3.  **Push:** It securely pushes the images to Amazon ECR.
4.  **Update Task Definition:** It downloads the *latest* active ECS Task Definition from AWS (which includes all the secrets managed by Terraform) and replaces the old Docker image hash with the newly built image hash.
5.  **Deploy:** It tells the ECS Services to deploy the updated Task Definition. ECS will gracefully boot up the new containers and shut down the old ones without any downtime.

---

## 4. Operational Procedures

### Managing Environment Variables & Secrets
The `.env` files in your codebase are **strictly for local development**. Production secrets must be managed via Terraform.

To add a new secret (e.g., a new AI API Key):
1.  Open `infra/terraform/variables.tf` and define the new variable.
2.  Open `infra/terraform/ecs.tf` and map the variable into the `environment` array of the backend container definition.
3.  Open `infra/terraform/terraform.tfvars` locally and securely add the actual API key value.
4.  Run `terraform apply`.
5.  Force a deployment so the containers restart with the new secret (either by merging a PR to `main` or running the AWS CLI command below).

### Forcing a Manual Container Restart
If you updated secrets via Terraform but didn't change any application code, you can manually force AWS to spin up fresh containers to load the new secrets:

```bash
aws ecs update-service \
  --cluster phygitron-cluster \
  --service backend-service \
  --force-new-deployment
```

### Viewing Production Logs
Because the application runs in serverless containers, logs are captured in **AWS CloudWatch**.

*   **Backend Logs:** Go to CloudWatch Log Groups -> `/ecs/phygitron-backend`
*   **Frontend Logs:** Go to CloudWatch Log Groups -> `/ecs/phygitron-frontend`

You can also view logs from your terminal using the AWS CLI:
```bash
# View the latest 100 backend logs
aws logs get-log-events \
  --log-group-name /ecs/phygitron-backend \
  --log-stream-name <STREAM_NAME> \
  --limit 100
```

---

## 5. Adding Multi-Tenant Custom Domains
Phygitron 360 supports multi-tenant dynamic subdomains (e.g., `company1.phygitron360.com`). To enable this on production:

1.  **Purchase a Domain** in AWS Route 53 (e.g., `phygitron360.com`).
2.  **Create an SSL Certificate** in AWS Certificate Manager (ACM) for `*.phygitron360.com`.
3.  **Update the ALB:** In `infra/terraform/alb.tf`, attach the SSL certificate to the Load Balancer to enable HTTPS (Port 443).
4.  **Create a Wildcard DNS Record:** In Route 53, create an `A` record for `*.phygitron360.com` that routes as an "Alias" to the Application Load Balancer.
5.  **Update React Logic:** Ensure the React frontend `detectSubdomain()` function in `LoginPage.jsx` is aware of the new production base domain so it properly extracts the tenant ID.
