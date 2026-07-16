# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "phygitron-cluster"
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_execution_role" {
  name = "ecs_execution_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Log Groups
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/phygitron-backend"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/phygitron-frontend"
  retention_in_days = 7
}

# ---------------------------------------------------------
# Backend Task & Service
# ---------------------------------------------------------
resource "aws_ecs_task_definition" "backend" {
  family                   = "phygitron-backend-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "backend-container"
      # Initially we point to the repository. The GH Action will update this to the specific tag.
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
        }
      ]
      environment = [
        { name = "DB_HOST", value = aws_db_instance.postgres.address },
        { name = "DB_PORT", value = "5432" },
        { name = "DB_NAME", value = "phygitron360" },
        { name = "DB_USER", value = var.db_username },
        { name = "DB_PASSWORD", value = var.db_password },
        { name = "SUPERADMIN_EMAIL", value = var.superadmin_email },
        { name = "SUPERADMIN_PASSWORD", value = var.superadmin_password },
        { name = "SECRET_KEY", value = var.secret_key },
        { name = "SMTP_HOST", value = var.smtp_host },
        { name = "SMTP_PORT", value = var.smtp_port },
        { name = "SMTP_USER", value = var.smtp_user },
        { name = "SMTP_PASS", value = var.smtp_pass },
        { name = "GOOGLE_API_KEY", value = var.google_api_key },
        { name = "GEMINI_API_KEYS", value = var.gemini_api_keys },
        { name = "GEMINI_RPM_LIMIT", value = var.gemini_rpm_limit },
        { name = "GEMINI_MODEL", value = var.gemini_model },
        { name = "OPENAI_API_KEY", value = var.openai_api_key },
        { name = "GROQ_API_KEY", value = var.groq_api_key },
        { name = "AI_PROVIDER", value = var.ai_provider },
        { name = "BULK_AI_PROVIDER", value = var.bulk_ai_provider },
        { name = "BULK_PARSE_WORKERS", value = var.bulk_parse_workers },
        { name = "GROQ_MODEL", value = var.groq_model },
        { name = "SENDER_NAME", value = var.sender_name },
        { name = "COMPANY_NAME", value = var.company_name },
        { name = "APP_BASE_URL", value = "http://${aws_lb.main.dns_name}" },
        { name = "AWS_S3_BUCKET", value = "phygitron360-uploads" },
        { name = "AWS_S3_REGION", value = var.aws_region }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "backend" {
  name            = "backend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1.id, aws_subnet.public_2.id]
    security_groups  = [aws_security_group.ecs_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend-container"
    container_port   = 8000
  }

  # Ignore task definition changes so CI/CD can deploy new versions without Terraform overwriting them
  lifecycle {
    ignore_changes = [task_definition]
  }
}

# ---------------------------------------------------------
# Frontend Task & Service
# ---------------------------------------------------------
resource "aws_ecs_task_definition" "frontend" {
  family                   = "phygitron-frontend-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn

  container_definitions = jsonencode([
    {
      name      = "frontend-container"
      image     = "${aws_ecr_repository.frontend.repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = 80
          hostPort      = 80
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.frontend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "frontend" {
  name            = "frontend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [aws_subnet.public_1.id, aws_subnet.public_2.id]
    security_groups  = [aws_security_group.ecs_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend-container"
    container_port   = 80
  }

  lifecycle {
    ignore_changes = [task_definition]
  }
}

# ---------------------------------------------------------
# S3 ECS Task Role and Permissions
# ---------------------------------------------------------
resource "aws_iam_role" "ecs_task_role" {
  name = "phygitron-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "s3_access_policy" {
  name        = "phygitron-ecs-s3-access-policy"
  description = "Allows the backend app to upload and get objects from S3 uploads bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::phygitron360-uploads/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_s3_attach" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.s3_access_policy.arn
}
