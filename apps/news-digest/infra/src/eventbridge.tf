data "aws_subnets" "default" {
  filter {
    name   = "default-for-az"
    values = ["true"]
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
      assign_public_ip = true
    }
  }
}
