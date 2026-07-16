# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  # Using public subnets here for simplicity/cost, but secured by SG. 
  # In strict prod, create private subnets and a NAT Gateway.
  subnet_ids = [aws_subnet.public_1.id, aws_subnet.public_2.id]
}

# RDS Instance
resource "aws_db_instance" "postgres" {
  identifier             = "${var.project_name}-db"
  allocated_storage      = 20
  engine                 = "postgres"
  engine_version         = "14"
  instance_class         = "db.t4g.micro" # Cost effective graviton instance
  db_name                = "phygitron360"
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db_sg.id]
  skip_final_snapshot    = false # Safe for production backups
  publicly_accessible    = false
}