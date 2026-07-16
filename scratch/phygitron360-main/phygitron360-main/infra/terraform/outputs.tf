output "alb_dns_name" {
  description = "The DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "db_endpoint" {
  description = "The endpoint of the RDS database"
  value       = aws_db_instance.postgres.endpoint
}

output "ecr_repository_backend" {
  value = aws_ecr_repository.backend.repository_url
}

output "ecr_repository_frontend" {
  value = aws_ecr_repository.frontend.repository_url
}
