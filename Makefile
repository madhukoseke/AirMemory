PYTHON ?= python3
API_PORT ?= 8000

.PHONY: seed seed-app seed-memory emit worker reset demo dashboard api web eval test smoke web-check check

seed: seed-memory

seed-app:
	$(PYTHON) -m app.cli seed

seed-memory:
	$(PYTHON) scripts/seed_memory.py

emit:
	$(PYTHON) scripts/emit_demo_failure.py

worker:
	$(PYTHON) scripts/run_worker.py --once

reset:
	$(PYTHON) scripts/reset_demo.py

demo:
	./scripts/run_demo.sh

dashboard:
	streamlit run airmemory/dashboard/app.py

api:
	uvicorn app.main:app --reload --host 127.0.0.1 --port $(API_PORT)

web:
	cd web && npm run dev

eval:
	$(PYTHON) -m app.cli eval

test:
	pytest

web-check:
	cd web && npm run lint && npm run build

check: test smoke web-check

smoke:
	$(PYTHON) scripts/seed_memory.py
	$(PYTHON) scripts/emit_demo_failure.py
	$(PYTHON) scripts/run_worker.py --once
