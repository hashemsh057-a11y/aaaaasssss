import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("maintenance", "0004_maintenancerequest_assigned_public_engineer"),
    ]

    operations = [
        migrations.AddField(
            model_name="maintenancerequest",
            name="cost",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Total maintenance cost in local currency.",
                max_digits=12,
                null=True,
                validators=[django.core.validators.MinValueValidator(0)],
            ),
        ),
    ]
