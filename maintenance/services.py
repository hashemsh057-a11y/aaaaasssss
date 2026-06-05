from .models import MaintenanceRequest


def duration_to_seconds(value):
    if value is None:
        return None
    return round(value.total_seconds(), 2)


class MaintenanceDashboardService:
    def __init__(self, queryset=None):
        self.queryset = queryset if queryset is not None else MaintenanceRequest.objects.all()

    def total_open_requests(self):
        return self.queryset.total_open_requests()

    def completion_rate(self):
        return self.queryset.completion_rate()

    def top_recurring_maintenance_issues(self, limit=5):
        issue_labels = dict(MaintenanceRequest._meta.get_field("issue_type").choices)
        return [
            {
                "issue_type": row["issue_type"],
                "label": issue_labels.get(row["issue_type"], row["issue_type"]),
                "total": row["total"],
            }
            for row in self.queryset.top_recurring_issues(limit=limit)
        ]

    def fastest_responding_engineer(self):
        row = self.queryset.fastest_responding_engineer()
        if row is None:
            return None
        first_name = row["assigned_engineer__user__first_name"]
        last_name = row["assigned_engineer__user__last_name"]
        full_name = f"{first_name} {last_name}".strip() or row["assigned_engineer__employee_id"]
        return {
            "engineer_id": row["assigned_engineer_id"],
            "employee_id": row["assigned_engineer__employee_id"],
            "full_name": full_name,
            "average_response_seconds": duration_to_seconds(row["average_response_time"]),
            "handled_requests": row["handled_requests"],
        }

    def average_resolution_time(self):
        return duration_to_seconds(self.queryset.average_resolution_time())

    def as_dict(self):
        return {
            "total_open_requests": self.total_open_requests(),
            "completion_rate": self.completion_rate(),
            "top_recurring_maintenance_issues": self.top_recurring_maintenance_issues(),
            "fastest_responding_engineer": self.fastest_responding_engineer(),
            "average_resolution_seconds": self.average_resolution_time(),
        }
