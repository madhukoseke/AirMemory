PYTHON ?= python3
API_PORT ?= 8000

.PHONY: seed api web eval test smoke

seed:
	$(PYTHON) -m app.cli seed

api:
	uvicorn app.main:app --reload --host 127.0.0.1 --port $(API_PORT)

web:
	cd web && npm run dev

eval:
	$(PYTHON) -m app.cli eval

test:
	pytest

smoke:
	$(PYTHON) -m app.cli seed
	$(PYTHON) -m app.cli eval
