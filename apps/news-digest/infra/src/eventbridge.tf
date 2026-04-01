data "aws_subnets" "default" {
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

data "aws_vpc" "default" {
  default = true
}

resource "aws_security_group" "ecs_task" {
  name        = "${var.app_name}-ecs-task"
  description = "Allow outbound HTTPS only for news digest pipeline"
  vpc_id      = data.aws_vpc.default.id

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS outbound to external APIs"
  }

  # DNS resolution
  egress {
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "DNS resolution"
  }

  tags = {
    Name    = "${var.app_name}-ecs-task"
    Purpose = "ECS task security group — outbound HTTPS only"
  }
}

resource "aws_cloudwatch_event_rule" "daily_trigger" {
  name                = "${var.app_name}-daily-trigger"
  description         = "Triggers news digest pipeline at 7 AM BRT (10 UTC) on weekdays"
  schedule_expression = var.schedule_expression
  tags                = { Name = "${var.app_name}-daily-trigger", Purpose = "Daily pipeline schedule" }
}

resource "aws_cloudwatch_event_target" "ecs_task" {
  rule     = aws_cloudwatch_event_rule.daily_trigger.name
  arn      = aws_ecs_cluster.main.arn
  role_arn = aws_iam_role.eventbridge.arn

  ecs_target {
    task_definition_arn = aws_ecs_task_definition.pipeline.arn
    task_count          = 1
    launch_type         = "FARGATE"

    network_configuration {
      subnets          = data.aws_subnets.default.ids
      security_groups  = [aws_security_group.ecs_task.id]
      assign_public_ip = true
    }
  }
}
