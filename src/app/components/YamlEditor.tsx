import { yaml } from '@codemirror/lang-yaml'
import CodeMirror from '@uiw/react-codemirror'

export function YamlEditor({
  value,
  onChange,
  readOnly,
}: {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[var(--border)]">
      <CodeMirror
        value={value}
        height="420px"
        theme="dark"
        extensions={[yaml()]}
        readOnly={readOnly}
        onChange={onChange}
        basicSetup={{ lineNumbers: true, foldGutter: true }}
      />
    </div>
  )
}
