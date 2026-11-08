SHELL := /bin/bash

PYTHON   ?= python3
PORT     ?= 8090
MOCK_PORT ?= 7071
BIND     ?= 0.0.0.0

ROOT     := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
RUN_DIR  := $(ROOT)/.run
PID_FILE := $(RUN_DIR)/serve.pid
LOG_FILE := $(RUN_DIR)/serve.log

ENTRY  := /
ASSETS := sdk/vendor/zorzal/zorzal-0.1.0.min.css sdk/compat/theme.css sdk/compat/pages/inicio.js sdk/compat/pages/estados.js

.DEFAULT_GOAL := help

.PHONY: help serve mock demo start stop restart status logs check urls doctor clean

help: ## Muestra esta ayuda
	@echo "Halcón · servidor de desarrollo"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "Variables: PORT=$(PORT) BIND=$(BIND)"
	@echo "Entrada:   $(ENTRY) (sdk/index.html vía scripts/serve.py)"

serve: ## Sirve el repo en primer plano (Ctrl+C para cortar)
	@echo "Halcon en http://$(BIND):$(PORT)/ - Ctrl+C para cortar"
	@exec $(PYTHON) -u $(ROOT)/scripts/serve.py $(PORT) --bind $(BIND)

mock: ## Levanta el emulador de la API en primer plano (Ctrl+C para cortar)
	@echo "Emulador Halcón en http://127.0.0.1:$(MOCK_PORT)/ · Ctrl+C para cortar"
	@exec env MOCK_PORT=$(MOCK_PORT) node mock/server.mjs

demo: ## Levanta el emulador y el servidor de desarrollo juntos (Ctrl+C para cortar)
	@echo "Halcón demo: emulador en http://127.0.0.1:$(MOCK_PORT)/ y servidor en http://$(BIND):$(PORT)/"
	@echo "App:         http://127.0.0.1:$(PORT)/?api=http://127.0.0.1:$(MOCK_PORT)"
	@set -e; \
	env MOCK_PORT=$(MOCK_PORT) node $(ROOT)/mock/server.mjs & mock=$$!; \
	$(PYTHON) -u $(ROOT)/scripts/serve.py $(PORT) --bind $(BIND) & serve=$$!; \
	trap 'kill $$mock $$serve 2>/dev/null; wait $$mock $$serve 2>/dev/null' INT TERM EXIT; \
	listo=0; \
	for i in $$(seq 1 40); do \
		if curl -fsS -o /dev/null "http://127.0.0.1:$(PORT)/" 2>/dev/null \
			&& curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$(MOCK_PORT)/api/me" 2>/dev/null | grep -q 401; then \
			listo=1; \
			break; \
		fi; \
		if ! kill -0 $$mock 2>/dev/null || ! kill -0 $$serve 2>/dev/null; then \
			break; \
		fi; \
		sleep 0.25; \
	done; \
	if [ $$listo -eq 1 ]; then \
		echo "Demo lista: Ctrl+C corta el emulador y el servidor"; \
	else \
		echo "ERROR: el emulador o el servidor no respondieron"; \
		exit 1; \
	fi; \
	wait

start: ## Arranca el servidor en segundo plano
	@mkdir -p $(RUN_DIR)
	@if [ -f $(PID_FILE) ] && kill -0 "$$(cat $(PID_FILE))" 2>/dev/null; then \
		echo "Halcón ya está corriendo (PID $$(cat $(PID_FILE))) en http://$(BIND):$(PORT)/"; \
	else \
		if command -v ss >/dev/null && ss -ltn 2>/dev/null | awk '{print $$4}' | grep -qE '[:.]$(PORT)$$'; then \
			echo "ERROR: el puerto $(PORT) está ocupado. Probá: make start PORT=8091"; exit 1; \
		fi; \
		nohup $(PYTHON) -u $(ROOT)/scripts/serve.py $(PORT) --bind $(BIND) >$(LOG_FILE) 2>&1 & \
		echo $$! > $(PID_FILE); \
		for i in $$(seq 1 40); do \
			if curl -fsS -o /dev/null "http://127.0.0.1:$(PORT)/" 2>/dev/null; then \
				echo "Halcón sirviendo en http://$(BIND):$(PORT)/ (PID $$(cat $(PID_FILE)))"; \
				exit 0; \
			fi; \
			sleep 0.25; \
		done; \
		echo "ERROR: el servidor no respondió. Log: $(LOG_FILE)"; \
		tail -20 $(LOG_FILE); \
		exit 1; \
	fi

stop: ## Detiene el servidor en segundo plano
	@if [ -f $(PID_FILE) ] && kill -0 "$$(cat $(PID_FILE))" 2>/dev/null; then \
		kill "$$(cat $(PID_FILE))" && echo "Halcón detenido"; \
	else \
		echo "Halcón no estaba corriendo"; \
	fi
	@rm -f $(PID_FILE)

restart: stop start ## Reinicia el servidor en segundo plano

status: ## Muestra el estado del servidor
	@if [ -f $(PID_FILE) ] && kill -0 "$$(cat $(PID_FILE))" 2>/dev/null; then \
		echo "Servidor: corriendo (PID $$(cat $(PID_FILE))) en http://$(BIND):$(PORT)/"; \
		code=$$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$(PORT)/"); \
		echo "HTTP:     $$code /"; \
	else \
		echo "Servidor: detenido"; \
	fi

logs: ## Sigue el log del servidor en segundo plano
	@mkdir -p $(RUN_DIR)
	@touch $(LOG_FILE)
	@tail -f $(LOG_FILE)

check: ## Verifica que la app y sus assets respondan por HTTP local
	@fail=0; \
	for path in $(ENTRY) $(ASSETS); do \
		code=$$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$(PORT)/$${path#/}"); \
		if [ "$$code" = "200" ]; then printf '  ok   %s\n' "$$path"; \
		else printf '  FAIL %s (%s)\n' "$$path" "$$code"; fail=1; fi; \
	done; \
	if [ $$fail -ne 0 ]; then echo "Revisá: make status / make logs"; exit 1; fi; \
	echo "Todo responde por http://127.0.0.1:$(PORT)/"

urls: ## Imprime las URLs del servidor
	@echo "Local: http://localhost:$(PORT)/"
	@ip=$$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($$i=="src") print $$(i+1)}'); \
	if [ -n "$$ip" ]; then echo "Red:   http://$$ip:$(PORT)/  (escucha en $(BIND))"; fi

doctor: ## Chequea dependencias y puerto
	@ok=1; \
	command -v $(PYTHON) >/dev/null 2>&1 || { echo "  FAIL python3 no encontrado"; ok=0; }; \
	command -v curl    >/dev/null 2>&1 || { echo "  FAIL curl no encontrado"; ok=0; }; \
	if command -v ss >/dev/null && ss -ltn 2>/dev/null | awk '{print $$4}' | grep -qE '[:.]$(PORT)$$'; then \
		echo "  WARN puerto $(PORT) ocupado"; \
	else \
		echo "  ok   puerto $(PORT) libre"; \
	fi; \
	[ $$ok -eq 1 ] || exit 1

clean: stop ## Detiene el servidor y limpia artefactos de .run
	@rm -rf $(RUN_DIR)
	@echo "Limpio"
