import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),

  // Docker runtime state
  dockerContainerId: text('docker_container_id'),
  dockerContainerName: text('docker_container_name').notNull().unique(),

  // Internal ports (inside the container)
  internalModbusPort: integer('internal_modbus_port').notNull().default(502),
  internalApiPort: integer('internal_api_port').notNull().default(8000),

  // Optional host-side port mapping
  hostModbusPort: integer('host_modbus_port'),
  hostApiPort: integer('host_api_port'),

  // Simulation config
  tickInterval: real('tick_interval').notNull().default(1.0),
  seed: integer('seed'),

  // Custom YAML — null for built-in types
  yamlConfig: text('yaml_config'),

  createdAt: integer('created_at').notNull(),
})

export type Device = typeof devices.$inferSelect
export type NewDevice = typeof devices.$inferInsert

// ─── Templates ────────────────────────────────────────────────────────────────

export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // device type key or 'custom'
  internalModbusPort: integer('internal_modbus_port').notNull().default(502),
  internalApiPort: integer('internal_api_port').notNull().default(8000),
  tickInterval: real('tick_interval').notNull().default(1.0),
  seed: integer('seed'),
  yamlConfig: text('yaml_config'),
  createdAt: integer('created_at').notNull(),
})

export type Template = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert
