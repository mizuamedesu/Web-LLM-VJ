import { useEffect, useRef } from 'react';
import './CodeEditor.css';

interface CodeEditorProps {
  code: string;
  isVisible: boolean;
}

export function CodeEditor({ code, isVisible }: CodeEditorProps) {
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [code]);

  if (!isVisible) return null;

  return (
    <div className="code-editor-overlay">
      <div className="code-editor-container">
        <div className="code-editor-header">
          <span className="code-editor-title">Generating GLSL Shader...</span>
          <div className="code-editor-spinner"></div>
        </div>
        <pre className="code-editor-content" ref={codeRef} data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
