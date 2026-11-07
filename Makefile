SHELL := /bin/bash

PYTHON   ?= python3
PORT     ?= 8090
MOCK_PORT ?= 7071
BIND     ?= 0.0.0.0
TS_HOST  ?= n53s.tail49474.ts.net

ROOT     := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
RUN_DIR  := $(ROOT)/.run
PID_FILE := $(RUN_DIR)/serve.pid
LOG_FILE := $(RUN_DIR)/serve.log

PILOTS := sdk/pilot.html sdk/pilot-plugins.html sdk/pilot-dashboard.html
ASSETS := sdk/vendor/zorzal/src/zorzal.css sdk/compat/theme.css sdk/compat/pages/inicio.js sdk/compat/pages/estados.js

.DEFAULT_GOAL := help

.PHONY: help serve legacy mock demo start stop restart status logs check urls tailscale-up tailscale-down doctor clean

help: ## Muestra esta ayuda
	@echo "Halcón · servidor de desarrollo"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "Variables: PORT=$(PORT) BIND=$(BIND) TS_HOST=$(TS_HOST)"
	@echo "Pilotos:   $(PILOTS)"

serve: ## Sirve el repo en primer plano (Ctrl+C para cortar)
	@echo "Halcon en http://$(BIND):$(PORT)/sdk/index.html - Ctrl+C para cortar"
	@exec node scripts/serve.mjs $(PORT) --bind $(BIND)

legacy: ## Sirve el arranque heredado de Webix (source-legacy.json) en primer plano
	@echo "Halcón heredado en http://$(BIND):$(PORT)/ · Ctrl+C para cortar"
	@echo "Manifiesto: sdk/config/source-legacy.json"
	@exec $(PYTHON) -c 'import sys; \
exec("\n".join([ \
	"from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer", \
	"import os, sys, time", \
	"raiz, bind, puerto = sys.argv[1], sys.argv[2], int(sys.argv[3])", \
	"html = open(os.path.join(raiz, \"sdk\", \"index.html\"), encoding=\"utf-8\").read()", \
	"html = html.replace(\"config/source.json\", \"config/source-legacy.json\").replace(\"{url}\", \"\")", \
	"class H(SimpleHTTPRequestHandler):", \
	"    def __init__(self, *a, **k):", \
	"        super().__init__(*a, directory=raiz, **k)", \
	"    def do_GET(self):", \
	"        ruta = self.path.split(\"?\")[0]", \
	"        if ruta == \"/\":", \
	"            datos = html.replace(\"{rand}\", str(int(time.time()))).encode(\"utf-8\")", \
	"            self.send_response(200)", \
	"            self.send_header(\"Content-Type\", \"text/html; charset=utf-8\")", \
	"            self.send_header(\"Content-Length\", str(len(datos)))", \
	"            self.end_headers()", \
	"            self.wfile.write(datos)", \
	"            return", \
	"        if ruta in (\"/index.html\", \"/sdk/index.html\"):", \
	"            self.send_response(302)", \
	"            self.send_header(\"Location\", \"/\")", \
	"            self.send_header(\"Content-Length\", \"0\")", \
	"            self.end_headers()", \
	"            return", \
	"        super().do_GET()", \
	"    def log_message(self, formato, *a):", \
	"        pass", \
	"ThreadingHTTPServer((bind, puerto), H).serve_forever()", \
]))' "$(ROOT)" "$(BIND)" $(PORT)

mock: ## Levanta el emulador de la API en primer plano (Ctrl+C para cortar)
	@echo "Emulador Halcón en http://127.0.0.1:$(MOCK_PORT)/ · Ctrl+C para cortar"
	@exec env MOCK_PORT=$(MOCK_PORT) node mock/server.mjs

demo: ## Levanta el emulador y el servidor de desarrollo juntos (Ctrl+C para cortar)
	@echo "Halcón demo: emulador en http://127.0.0.1:$(MOCK_PORT)/ y servidor en http://$(BIND):$(PORT)/"
	@echo "Piloto:      http://127.0.0.1:$(PORT)/sdk/pilot-dashboard.html?api=http://127.0.0.1:$(MOCK_PORT)"
	@set -e; \
	env MOCK_PORT=$(MOCK_PORT) node mock/server.mjs & mock=$$!; \
	$(PYTHON) -m http.server $(PORT) --bind $(BIND) --directory $(ROOT) & serve=$$!; \
	trap 'kill $$mock $$serve 2>/dev/null; wait $$mock $$serve 2>/dev/null' INT TERM EXIT; \
	listo=0; \
	for i in $$(seq 1 40); do \
		if curl -fsS -o /dev/null "http://127.0.0.1:$(PORT)/sdk/pilot-dashboard.html" 2>/dev/null \
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
		nohup $(PYTHON) -m http.server $(PORT) --bind $(BIND) --directory $(ROOT) >$(LOG_FILE) 2>&1 & \
		echo $$! > $(PID_FILE); \
		for i in $$(seq 1 40); do \
			if curl -fsS -o /dev/null "http://127.0.0.1:$(PORT)/sdk/pilot.html" 2>/dev/null; then \
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

status: ## Muestra estado del servidor y de tailscale serve
	@if [ -f $(PID_FILE) ] && kill -0 "$$(cat $(PID_FILE))" 2>/dev/null; then \
		echo "Servidor: corriendo (PID $$(cat $(PID_FILE))) en http://$(BIND):$(PORT)/"; \
		code=$$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$(PORT)/sdk/pilot.html"); \
		echo "HTTP:     $$code /sdk/pilot.html"; \
	else \
		echo "Servidor: detenido"; \
	fi
	@echo "--- tailscale serve ---"
	@tailscale serve status 2>&1 || true

logs: ## Sigue el log del servidor en segundo plano
	@mkdir -p $(RUN_DIR)
	@touch $(LOG_FILE)
	@tail -f $(LOG_FILE)

check: ## Verifica que pilotos y assets respondan por HTTP local
	@fail=0; \
	for path in $(PILOTS) $(ASSETS); do \
		code=$$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$(PORT)/$$path"); \
		if [ "$$code" = "200" ]; then printf '  ok   %s\n' "$$path"; \
		else printf '  FAIL %s (%s)\n' "$$path" "$$code"; fail=1; fi; \
	done; \
	if [ $$fail -ne 0 ]; then echo "Revisá: make status / make logs"; exit 1; fi; \
	echo "Todo responde por http://127.0.0.1:$(PORT)/"

urls: ## Imprime las URLs locales y por tailnet
	@echo "Local:   http://localhost:$(PORT)/sdk/pilot-dashboard.html"
	@echo "Tailnet: http://$(TS_HOST):$(PORT)/sdk/pilot-dashboard.html"
	@echo "HTTPS:   https://$(TS_HOST)/sdk/pilot-dashboard.html   (requiere: make tailscale-up)"
	@echo
	@for p in $(PILOTS); do echo "  http://$(TS_HOST):$(PORT)/$$p"; done

tailscale-up: start ## Expone el servidor en https://TS_HOST (tailscale serve)
	@if timeout 10 tailscale serve --bg $(PORT); then \
		echo; \
		echo "Disponible en el tailnet:"; \
		for p in $(PILOTS); do echo "  https://$(TS_HOST)/$$p"; done; \
	else \
		echo; \
		echo "No se pudo activar tailscale serve."; \
		echo "Habilitá Serve en tu tailnet desde el enlace que imprime tailscale y reintentá."; \
		echo "Mientras tanto, el acceso directo por tailnet sigue disponible:"; \
		for p in $(PILOTS); do echo "  http://$(TS_HOST):$(PORT)/$$p"; done; \
		exit 1; \
	fi

tailscale-down: ## Quita la configuración de tailscale serve
	@tailscale serve reset
	@echo "tailscale serve desactivado"

doctor: ## Chequea dependencias, puerto y estado de tailscale
	@ok=1; \
	command -v $(PYTHON) >/dev/null 2>&1 || { echo "  FAIL python3 no encontrado"; ok=0; }; \
	command -v curl    >/dev/null 2>&1 || { echo "  FAIL curl no encontrado"; ok=0; }; \
	command -v tailscale >/dev/null 2>&1 || { echo "  FAIL tailscale no encontrado"; ok=0; }; \
	if tailscale status >/dev/null 2>&1; then \
		ip=$$(tailscale ip -4 2>/dev/null | head -1); \
		dns=$$(getent hosts $(TS_HOST) 2>/dev/null | awk '{print $$1}' | head -1); \
		echo "  ok   tailscale (IP $$ip)"; \
		if [ -n "$$dns" ] && [ "$$dns" != "$$ip" ]; then \
			echo "  WARN $(TS_HOST) resuelve a $$dns, no a $$ip"; \
		elif [ -z "$$dns" ]; then \
			echo "  WARN $(TS_HOST) no resuelve por DNS"; \
		else \
			echo "  ok   $(TS_HOST) -> $$ip"; \
		fi; \
	else \
		echo "  FAIL tailscale no responde"; ok=0; \
	fi; \
	if command -v ss >/dev/null && ss -ltn 2>/dev/null | awk '{print $$4}' | grep -qE '[:.]$(PORT)$$'; then \
		echo "  WARN puerto $(PORT) ocupado"; \
	else \
		echo "  ok   puerto $(PORT) libre"; \
	fi; \
	[ $$ok -eq 1 ] || exit 1

clean: stop ## Detiene el servidor y limpia artefactos de .run
	@rm -rf $(RUN_DIR)
	@echo "Limpio"
