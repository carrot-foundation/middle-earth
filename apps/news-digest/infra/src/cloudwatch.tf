resource "aws_cloudwatch_log_group" "pipeline" {
  name              = "/ecs/${var.app_name}-pipeline"
  retention_in_days = 30
  tags              = { Name = "/ecs/${var.app_name}-pipeline", Purpose = "Pipeline execution logs" }
}
