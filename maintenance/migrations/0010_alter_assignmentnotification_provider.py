from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("maintenance", "0009_portalotpchallenge_requestactivity_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="assignmentnotification",
            name="provider",
            field=models.CharField(
                choices=[
                    ("CLOUDFLARE", "Cloudflare Email"),
                    ("BREVO", "Brevo"),
                    ("SMTP", "SMTP"),
                    ("DISABLED", "Disabled"),
                ],
                max_length=16,
            ),
        ),
    ]
