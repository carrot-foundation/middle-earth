resource "aws_ecs_cluster" "main" {
  name = "${var.app_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = { Name = "${var.app_name}-cluster", Purpose = "News digest pipeline cluster" }
}

resource "aws_ecs_task_definition" "pipeline" {
  family                   = "${var.app_name}-pipeline"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "${var.app_name}-pipeline"
    image     = "${aws_ecr_repository.pipeline.repository_url}:latest"
    essential = true

    environment = [
      { name = "S3_BUCKET", value = var.s3_bucket_name },
      { name = "S3_STATE_KEY", value = "processed-articles.json" },
      { name = "S3_ARTICLES_PREFIX", value = "articles/" },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "SLACK_CHANNEL_ID", value = var.slack_channel_id },
      { name = "NOTION_DATABASE_ID", value = var.notion_database_id },
      { name = "GMAIL_TO", value = var.gmail_to },
      { name = "CARBON_PULSE_SECRET_ARN", value = aws_secretsmanager_secret.carbon_pulse.arn },
      { name = "SLACK_TOKEN_SECRET_ARN", value = aws_secretsmanager_secret.slack_token.arn },
      { name = "ANTHROPIC_API_KEY_SECRET_ARN", value = aws_secretsmanager_secret.anthropic_api_key.arn },
      { name = "NOTION_TOKEN_SECRET_ARN", value = aws_secretsmanager_secret.notion_token.arn },
      { name = "GMAIL_SECRET_ARN", value = aws_secretsmanager_secret.gmail_credentials.arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.pipeline.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])

  tags = { Name = "${var.app_name}-pipeline", Purpose = "News digest pipeline task" }
}
