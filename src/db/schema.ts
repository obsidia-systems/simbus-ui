import { relations } from 'drizzle-orm'
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** Catalog id, e.g. `builtin/generic-tnh-sensor`. Null for freeform YAML. */
  presetId: text('preset_id'),
  /** Absolute or data-relative path to the instance YAML on the UI filesystem. */
  instancePath: text('instance_path').notNull(),
  yamlHash: text('yaml_hash').notNull(),
  dockerContainerId: text('docker_container_id'),
  dockerContainerName: text('docker_container_name').notNull().unique(),
  tickInterval: real('tick_interval').notNull().default(1.0),
  timeScale: real('time_scale').notNull().default(1.0),
  seed: integer('seed'),
  /** Desired reconciler state. */
  desiredState: text('desired_state', { enum: ['running', 'stopped'] })
    .notNull()
    .default('running'),
  /**
   * Loopback-only HTTP port for SIMBUS_UI_MODE=host.
   * Never published in docker mode. Not a field-plane lease.
   */
  controlHostPort: integer('control_host_port'),
  createdAt: integer('created_at').notNull(),
})

export const portLeases = sqliteTable('port_leases', {
  id: text('id').primaryKey(),
  deviceId: text('device_id')
    .notNull()
    .references(() => devices.id, { onDelete: 'cascade' }),
  protocol: text('protocol').notNull(),
  containerPort: integer('container_port').notNull(),
  hostPort: integer('host_port').notNull(),
  proto: text('proto', { enum: ['tcp', 'udp'] })
    .notNull()
    .default('tcp'),
  published: integer('published', { mode: 'boolean' }).notNull().default(true),
})

export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  sourcePresetId: text('source_preset_id'),
  yamlConfig: text('yaml_config').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const devicesRelations = relations(devices, ({ many }) => ({
  portLeases: many(portLeases),
}))

export const portLeasesRelations = relations(portLeases, ({ one }) => ({
  device: one(devices, {
    fields: [portLeases.deviceId],
    references: [devices.id],
  }),
}))

export type Device = typeof devices.$inferSelect
export type NewDevice = typeof devices.$inferInsert
export type PortLease = typeof portLeases.$inferSelect
export type NewPortLease = typeof portLeases.$inferInsert
export type Template = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert
