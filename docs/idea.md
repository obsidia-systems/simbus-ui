# Simbus — Industrial Field Device Simulator

> Simulate Modbus TCP field devices for SCADA labs, integration testing, and operator training. Protocol-agnostic by design. Modbus TCP first.

---

## Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Background & Theory](#background--theory)
4. [Repositories](#repositories)
5. [Architecture](#architecture)
6. [simbus — Core Engine](#simbus--core-engine)
7. [simbus-ui — Admin Interface](#simbus-ui--admin-interface)
8. [Device Model & YAML Schema](#device-model--yaml-schema)
9. [Simulation Engine](#simulation-engine)
10. [Roadmap](#roadmap)
11. [Non-Goals](#non-goals)
12. [Contributing](#contributing)

---

## Overview

**Simbus** is an open-source industrial field device simulator. It creates virtual Modbus TCP devices — sensors, UPS units, PDUs, CRACs, and more — that behave like real hardware on the network. Any SCADA, HMI, or Modbus client can connect to them without modification.

It is composed of two independent tools:

| Repository  | Role                                                        | Standalone        |
| ----------- | ----------------------------------------------------------- | ----------------- |
| `simbus`    | Core engine: Modbus TCP server, REST API, simulation engine | ✅ Yes            |
| `simbus-ui` | Web admin: create, configure, and control devices visually  | Requires `simbus` |

**Primary use cases:**

- Build SCADA/HMI labs without physical hardware
- Test alarm and notification pipelines
- Train operators on realistic telemetry
- Develop and validate tag configurations in tools like Ignition, Wonderware, or FactoryTalk
- Demo BMS/DCIM integrations to clients

---

## Problem Statement

Setting up a realistic SCADA lab requires physical hardware — UPS units, sensors, PDUs — that is expensive, space-consuming, and fragile. Existing Modbus simulators are either too simple (static registers), too complex to configure, or not containerized.

Simbus solves this by providing:

- Realistic, dynamic device behavior (noise, drift, cycles, faults)
- Full containerization — spin up a lab in seconds with Docker or Podman
- A REST API for programmatic control — inject faults, change values, simulate scenarios
- A web UI for teams who prefer a visual interface
- A YAML-based device definition format — extensible, versionable, shareable

---

## Background & Theory

### What is Modbus TCP?

Modbus is one of the oldest and most widely deployed industrial communication protocols, originally designed by Modicon in 1979. **Modbus TCP** is its Ethernet adaptation: it encapsulates Modbus frames inside standard TCP/IP packets, making it compatible with modern network infrastructure.

In a Modbus TCP session:

- The **client** (Master) initiates requests — typically a SCADA system or PLC
- The **server** (Slave) responds with data — the field device
- Communication is synchronous and request/response based
- Each device is identified by a **Unit ID** (1–247)
- Data is organized in four address spaces:

| Data Type         | Address Space | Read | Write |
| ----------------- | ------------- | ---- | ----- |
| Coils             | 0x            | ✅   | ✅    |
| Discrete Inputs   | 1x            | ✅   | ❌    |
| Holding Registers | 4x            | ✅   | ✅    |
| Input Registers   | 3x            | ✅   | ❌    |

Holding Registers (16-bit unsigned integers) are the most common data type for analog values like temperature, voltage, and load percentage. A **scale factor** is used to represent decimals (e.g., `225` = `22.5°C` with a scale of `10`).

### Field Devices in a Data Center BMS

A **Building Management System (BMS)** aggregates telemetry from field devices across the facility. In a Data Center, these devices fall into the following categories:

**Power Infrastructure**

- **UPS (Uninterruptible Power Supply):** Reports battery level, input/output voltage, load percentage, estimated runtime, and fault status. Critical for power continuity events.
- **PDU (Power Distribution Unit):** Reports per-outlet or per-phase current, voltage, power (kW), and energy consumption (kWh). Rack PDUs often expose individual outlet control via coils.
- **Power Meter / Energy Analyzer:** High-precision measurement of AC power parameters — voltage (L-L and L-N), current per phase, power factor, active/reactive/apparent power, THD. Common brands: Schneider ION series, Siemens SENTRON.
- **Generator / Genset:** Reports fuel level, oil pressure, coolant temperature, running state, transfer switch status, and hour meter.

**Cooling Infrastructure**

- **CRAC (Computer Room Air Conditioning):** Reports supply/return air temperature, humidity, compressor state, fan speed (RPM or %), and filter status.
- **CRAH (Computer Room Air Handler):** Similar to CRAC but uses chilled water. Reports valve position, water inlet/outlet temperature, and fan speed.
- **Chiller:** Reports entering/leaving water temperature, compressor load, refrigerant pressure, and COP (Coefficient of Performance).
- **T&H Sensor (Temperature & Humidity):** The simplest and most abundant device. Reports ambient temperature (°C or °F) and relative humidity (%RH). Often deployed in hot/cold aisles, above/below raised floors, and at rack intake/exhaust.

**Physical Infrastructure**

- **Water/Leak Sensor:** Binary — wet or dry. Triggered by water under raised floors or near cooling units.
- **Door Contact Sensor:** Binary — open or closed. Monitors rack doors, room doors, and cage access.
- **Smoke Detector:** Binary alarm state. Often on separate life-safety networks but integrated in BMS for correlation.

### Why Modbus TCP First?

While a Data Center BMS uses multiple protocols (BACnet/IP for HVAC, SNMP for network PDUs, DNP3 for power systems), Modbus TCP is the best starting point because:

- It covers ~60–70% of power and basic sensor devices
- It is the simplest protocol to implement a server for
- It is natively supported by virtually all SCADA platforms
- It has mature open-source libraries in Python (`pymodbus`), Node.js, and Go
- Its register-based model maps cleanly to a YAML definition format

---

## Repositories

```bash
github.com/<your-org>/
  simbus        ← Python engine. Works standalone via CLI or REST API.
  simbus-ui     ← Astro + React web app. Visual control plane for simbus.
```

Each repository is independently versioned, released, and documented. `simbus-ui` declares `simbus` as a peer dependency (via Docker image tag or API version contract).

---

## Architecture

```bash
┌─────────────────────────────────────────────────────────────────┐
│                        Docker / Podman                          │
│                                                                 │
│  ┌──────────────────┐      ┌──────────────────────────────────┐│
│  │   SCADA / HMI    │      │          simbus (core)           ││
│  │  (e.g. Ignition) │      │                                  ││
│  │                  │─────▶│  ┌────────┐  ┌────────┐         ││
│  │  Modbus TCP      │      │  │ T&H    │  │  UPS   │  ...    ││
│  │  Client/Master   │      │  │:502    │  │ :502   │         ││
│  └──────────────────┘      │  └────────┘  └────────┘         ││
│                             │                                  ││
│  ┌──────────────────┐      │  Simulation Engine               ││
│  │   simbus-ui      │─────▶│  REST API  :8000                 ││
│  │  (Admin Web UI)  │      └──────────────────────────────────┘│
│  │  :3000           │                                          │
│  └──────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**

- Each virtual device runs its own Modbus TCP server on a dedicated port. This mirrors real hardware — each physical device has its own IP/port.
- The simulation engine runs in a background thread per device, updating register values on a configurable tick interval.
- The REST API is the single control plane — `simbus-ui` is a consumer of this API, not a special integration.
- Device definitions are YAML files. The engine loads them at startup or dynamically via API.

---

## `simbus` — Core Engine

### Tech Stack

| Component        | Technology                      |
| ---------------- | ------------------------------- |
| Language         | Python 3.12+                    |
| Modbus Server    | `pymodbus` >= 3.x               |
| REST API         | FastAPI + Uvicorn               |
| Async runtime    | asyncio                         |
| Config format    | YAML (PyYAML / ruamel.yaml)     |
| Containerization | Docker (official image on GHCR) |
| Testing          | pytest + pytest-asyncio         |
| Linting          | ruff + mypy                     |

### Repository Structure

```bash
simbus/
├── pyproject.toml
├── Dockerfile
├── docker-compose.yml            ← For local dev and standalone use
├── README.md
├── docs/
│   └── api.md                    ← REST API reference (auto-generated from OpenAPI)
├── devices/                      ← Built-in device definition library
│   ├── generic-tnh-sensor.yaml
│   ├── generic-ups.yaml
│   ├── generic-pdu.yaml
│   ├── generic-crac.yaml
│   └── generic-power-meter.yaml
├── simbus/
│   ├── __init__.py
│   ├── cli.py                    ← CLI entrypoint (simbus start, simbus list, etc.)
│   ├── config/
│   │   ├── loader.py             ← YAML → DeviceConfig parser + validator
│   │   └── schema.py             ← Pydantic models for device schema
│   ├── core/
│   │   ├── device.py             ← Base device class
│   │   ├── device_manager.py     ← Lifecycle: create, start, stop, list devices
│   │   └── modbus_server.py      ← pymodbus async server wrapper per device
│   ├── devices/
│   │   ├── tnh_sensor.py
│   │   ├── ups.py
│   │   ├── pdu.py
│   │   ├── crac.py
│   │   └── power_meter.py
│   ├── simulation/
│   │   ├── engine.py             ← Tick loop, applies behaviors to registers
│   │   ├── behaviors.py          ← gaussian_noise, sinusoidal, drift, step, constant
│   │   └── faults.py             ← Fault injection: freeze, spike, dropout, alarm
│   └── api/
│       ├── main.py               ← FastAPI app
│       ├── routers/
│       │   ├── devices.py        ← CRUD for devices
│       │   ├── registers.py      ← Read/write individual registers
│       │   └── simulation.py     ← Control simulation: faults, scenarios, speed
│       └── schemas.py            ← Pydantic response/request schemas
└── tests/
    ├── test_modbus_server.py
    ├── test_simulation_engine.py
    └── test_api.py
```

### REST API — Key Endpoints

```
GET    /devices                          List all running devices
POST   /devices                          Create and start a device from YAML body or built-in type
GET    /devices/{id}                     Get device status and register snapshot
DELETE /devices/{id}                     Stop and remove a device

GET    /devices/{id}/registers           Get all register values
PATCH  /devices/{id}/registers/{addr}    Override a register value manually

POST   /devices/{id}/faults              Inject a fault (type, duration)
DELETE /devices/{id}/faults              Clear all active faults

GET    /devices/{id}/simulation          Get simulation config
PATCH  /devices/{id}/simulation          Update tick rate, behavior params

GET    /scenarios                        List available scenario files
POST   /scenarios/{name}/run             Apply a scenario to one or more devices
```

### CLI Usage

```bash
# Install
pip install simbus

# Start a T&H sensor on port 502
simbus start --type generic-tnh-sensor --port 502 --name "hot-aisle-01"

# Start from a custom YAML
simbus start --file ./my-ups.yaml --port 502

# List running devices
simbus list

# Inject a fault via CLI
simbus fault --device hot-aisle-01 --type spike --register temperature --value 45.0 --duration 30s

# Launch with multiple devices from a compose-style config
simbus up --file simbus-devices.yaml
```

### Docker Usage

```bash
# Run a single device
docker run -p 502:502 -p 8000:8000 ghcr.io/your-org/simbus \
  simbus start --type generic-tnh-sensor --port 502

# Run with a custom device file
docker run -v ./devices:/devices -p 502:502 ghcr.io/your-org/simbus \
  simbus start --file /devices/my-sensor.yaml
```

---

## `simbus-ui` — Admin Interface

### Tech Stack

| Component              | Technology                               |
| ---------------------- | ---------------------------------------- |
| Framework              | Astro 5.x                                |
| Interactive components | React 19 (Astro islands)                 |
| Styling                | Tailwind CSS 4.x                         |
| Data fetching          | TanStack Query                           |
| Real-time updates      | SSE (Server-Sent Events) from simbus API |
| Charts / Gauges        | Recharts                                 |
| Containerization       | Docker (nginx static serve)              |

### Repository Structure

```
simbus-ui/
├── package.json
├── astro.config.mjs
├── Dockerfile
├── README.md
├── public/
└── src/
    ├── pages/
    │   ├── index.astro              ← Dashboard: all active devices
    │   ├── devices/
    │   │   ├── new.astro            ← Create device wizard
    │   │   └── [id].astro           ← Device detail + live registers
    │   └── scenarios.astro          ← Scenario management
    ├── components/
    │   ├── DeviceCard.tsx           ← Live register values, status badge
    │   ├── DeviceForm.tsx           ← Create/edit device form
    │   ├── RegisterTable.tsx        ← Live register viewer with manual override
    │   ├── FaultPanel.tsx           ← Fault injection controls
    │   ├── SimulationControls.tsx   ← Noise, drift, tick speed sliders
    │   └── GaugeWidget.tsx          ← Recharts-based analog gauge
    └── lib/
        ├── api.ts                   ← simbus REST API client
        └── types.ts                 ← Shared TypeScript types
```

### Key UI Screens

**Dashboard** — Grid of device cards. Each card shows device type, name, port, status (running/stopped/fault), and the most relevant register values live. One-click fault injection shortcut.

**Device Creator** — Step-by-step wizard:

1. Choose a built-in device type or upload a custom YAML
2. Configure name, port, unit ID
3. Override default register values and simulation parameters
4. Review and launch

**Device Detail** — Full register table with live updates via SSE. Each register row shows address, name, raw value, scaled value, unit, and an inline override input. Simulation behavior controls (noise std dev, drift rate, etc.) available per register.

**Fault Panel** — Select fault type (spike, freeze, dropout, high-alarm, low-alarm), target register, value/duration. Active faults shown with countdown timer and clear button.

**Scenarios** — Load a YAML scenario file that defines a sequence of events (value changes, faults, timing). Run against one or multiple devices simultaneously. Useful for demos: simulate a power outage sequence, a temperature runaway event, etc.

---

## Device Model & YAML Schema

A device definition is a YAML file that fully describes a virtual device: its Modbus register map, default values, and simulation behavior. This is the core extensibility mechanism of Simbus.

```yaml
# Example: generic-tnh-sensor.yaml
name: 'Generic T&H Sensor'
version: '1.0'
type: tnh_sensor
description: >
  Generic temperature and humidity sensor.
  Models a two-register Modbus device typical of
  environmental monitoring in hot/cold aisles.

modbus:
  default_port: 502
  unit_id: 1
  endianness: big # big | little | big_swap | little_swap

registers:
  holding:
    - address: 0
      name: temperature
      description: 'Ambient temperature'
      unit: '°C'
      default: 22.5
      scale: 10 # Raw register value = real value × scale
      data_type: uint16
      simulation:
        behavior: gaussian_noise
        std_dev: 0.3
        drift:
          enabled: true
          rate: 0.01 # °C per tick
          bounds: [18.0, 35.0]

    - address: 1
      name: humidity
      description: 'Relative humidity'
      unit: '%RH'
      default: 45.0
      scale: 10
      data_type: uint16
      simulation:
        behavior: sinusoidal
        period_hours: 12
        amplitude: 5.0

  coils:
    - address: 0
      name: high_temp_alarm
      description: 'High temperature alarm active'
      default: false
      trigger:
        source_register: temperature
        condition: gt
        threshold: 30.0

    - address: 1
      name: low_humidity_alarm
      description: 'Low humidity alarm active'
      default: false
      trigger:
        source_register: humidity
        condition: lt
        threshold: 30.0

alarms:
  - name: 'High Temperature'
    severity: warning
    trigger: high_temp_alarm
  - name: 'Low Humidity'
    severity: warning
    trigger: low_humidity_alarm
```

**Built-in device types** ship with the engine and can be referenced by name without a YAML file:

- `generic-tnh-sensor`
- `generic-ups`
- `generic-pdu`
- `generic-crac`
- `generic-power-meter`
- `generic-leak-sensor`
- `generic-door-contact`

---

## Simulation Engine

The simulation engine runs a background async loop (tick) for each active device. On every tick, it applies configured behaviors to each register and evaluates alarm triggers.

### Behaviors

| Behavior         | Description                            | Parameters                     |
| ---------------- | -------------------------------------- | ------------------------------ |
| `constant`       | Value never changes                    | `value`                        |
| `gaussian_noise` | Random noise around a mean             | `std_dev`                      |
| `sinusoidal`     | Periodic oscillation                   | `period_hours`, `amplitude`    |
| `drift`          | Slow linear trend with optional bounds | `rate`, `bounds`               |
| `sawtooth`       | Repeating ramp up then reset           | `period_seconds`, `min`, `max` |
| `step`           | Discrete step changes on a schedule    | `steps: [{at, value}]`         |

Behaviors can be composed: a register can have `gaussian_noise` layered on top of a `sinusoidal` base.

### Fault Types

| Fault           | Description                                         | Parameters                       |
| --------------- | --------------------------------------------------- | -------------------------------- |
| `spike`         | Force a register to an extreme value for a duration | `register`, `value`, `duration`  |
| `freeze`        | Stop updating a register (simulate a stuck sensor)  | `register`, `duration`           |
| `dropout`       | Set register to 0 or disconnect the device          | `duration`                       |
| `alarm`         | Force a coil to active state                        | `coil_address`, `duration`       |
| `noise_amplify` | Increase noise std_dev dramatically                 | `register`, `factor`, `duration` |

### Scenarios

A scenario is a YAML file describing a timed sequence of simulation events:

```yaml
# scenarios/power-outage.yaml
name: 'Power Outage Sequence'
description: 'Simulates a mains power loss and UPS switchover'
devices: [ups-01]

steps:
  - at: 0s
    action: set_register
    register: input_voltage
    value: 0

  - at: 2s
    action: inject_fault
    fault: alarm
    coil: on_battery_alarm

  - at: 5s
    action: set_register
    register: battery_charge
    behavior: drift
    rate: -0.5
    bounds: [0, 100]

  - at: 120s
    action: inject_fault
    fault: alarm
    coil: low_battery_alarm
```

---

## Roadmap

### v0.1 — Foundation _(MVP)_

- [ ] `simbus` core: pymodbus async server, device manager, YAML loader
- [ ] Built-in devices: `generic-tnh-sensor`, `generic-ups`, `generic-pdu`
- [ ] Simulation engine: `gaussian_noise`, `sinusoidal`, `constant`
- [ ] REST API: device CRUD, register read/write, basic fault injection
- [ ] Docker image published to GHCR
- [ ] `simbus-ui`: Dashboard, Device Creator (built-in types only), live register table
- [ ] `docker-compose.yml` example with Ignition + 3 devices

### v0.2 — Simulation Depth

- [ ] All built-in device types (CRAC, power meter, leak sensor, door contact)
- [ ] Full behavior set (drift, sawtooth, step, composed behaviors)
- [ ] Full fault set
- [ ] Alarm trigger system with coil auto-update
- [ ] `simbus-ui`: Fault Panel, Simulation Controls, Gauge widgets
- [ ] CLI: `simbus up` for multi-device startup from a single file
- [ ] Scenario engine v1

### v0.3 — Extensibility & UX

- [ ] `simbus-ui`: Device Creator accepts custom YAML upload
- [ ] `simbus-ui`: Scenario runner UI
- [ ] Device definition library (community YAML files for real device models)
- [ ] Prometheus metrics endpoint (`/metrics`) for observability
- [ ] OpenAPI spec published, SDKs auto-generated

### v1.0 — Multi-Protocol

- [ ] BACnet/IP support (HVAC devices: chillers, VAV, AHUs)
- [ ] SNMP v2c support (network PDUs: APC, Raritan)
- [ ] Protocol abstraction layer so device YAMLs declare protocol independently
- [ ] `simbus-ui`: Protocol selector in Device Creator

---

## Non-Goals

The following are explicitly out of scope to maintain focus:

- **Not a PLC emulator.** Simbus emulates field devices (slaves), not controllers (masters).
- **Not a full digital twin.** Physics-accurate models are not the goal — realistic-enough behavior for SCADA testing and demos is.
- **Not a security tool.** Simbus is for lab/dev environments. It has no authentication by default and should never be exposed to public networks.
- **Not a Modbus client/master.** Simbus does not poll other devices.
- **Not a replacement for vendor simulators.** Vendor-specific behavior quirks are not modeled in v1.

---

## Contributing

Simbus is open source under the MIT License.

**To add a new built-in device type:**

1. Create a YAML file in `simbus/devices/` following the schema
2. Add a Python class in `simbus/devices/` inheriting from `BaseDevice` if custom logic is needed
3. Register it in `simbus/core/device_manager.py`
4. Open a PR with a description of the real-world device it models

**To add a new simulation behavior:**

1. Add a function in `simbus/simulation/behaviors.py`
2. Register it in the behavior registry in `simbus/simulation/engine.py`
3. Document parameters in `docs/behaviors.md`

**Community device library:** The `devices/` folder in the `simbus` repo accepts community-contributed YAML definitions for real commercial devices (APC Smart-UPS, Schneider ION7650, Emerson Liebert, etc.) provided the register maps are sourced from public vendor documentation.

---

_Simbus is not affiliated with or endorsed by any SCADA vendor, hardware manufacturer, or industrial automation company._
