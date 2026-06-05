# PythonAnywhere Deployment

Replace `YOUR_USERNAME` with your PythonAnywhere username.

## 1. Upload code

```bash
cd ~
git clone <your-repo-url> TechMaintenanceSystem
cd TechMaintenanceSystem
```

## 2. Virtualenv

Use Python 3.12 or 3.13 on a recent PythonAnywhere system image.

```bash
mkvirtualenv --python=/usr/bin/python3.12 techmaintenance-env
pip install -r requirements.txt
```

## 3. Environment file

```bash
cp .env.pythonanywhere.example .env
nano .env
```

Set the real values for `DJANGO_SECRET_KEY`, database credentials, domains, and frontend URL.

## 4. Database

Create a MySQL database from the PythonAnywhere Databases tab, for example:

```text
YOUR_USERNAME$techmaintenance
```

Then run:

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic --noinput
```

## 5. Web tab

Create a Manual configuration web app using the same Python version as the virtualenv.

```text
Source code: /home/YOUR_USERNAME/TechMaintenanceSystem
Working directory: /home/YOUR_USERNAME/TechMaintenanceSystem
Virtualenv: /home/YOUR_USERNAME/.virtualenvs/techmaintenance-env
```

Static files mappings:

```text
URL:  /static/
Path: /home/YOUR_USERNAME/TechMaintenanceSystem/staticfiles

URL:  /media/
Path: /home/YOUR_USERNAME/TechMaintenanceSystem/media
```

## 6. WSGI file

Edit the WSGI file from the PythonAnywhere Web tab:

```python
import os
import sys

path = "/home/YOUR_USERNAME/TechMaintenanceSystem"
if path not in sys.path:
    sys.path.insert(0, path)

os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

Reload the web app from the Web tab.

## Frontend note

PythonAnywhere should host the Django API. The Next.js frontend is better hosted on Cloudflare Pages, Vercel, or another Node/static frontend host.

Set the frontend environment variable:

```text
NEXT_PUBLIC_API_BASE_URL=https://YOUR_USERNAME.pythonanywhere.com/api
```
