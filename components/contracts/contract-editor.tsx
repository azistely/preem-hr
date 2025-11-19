/**
 * Contract Editor Component
 *
 * Rich text editor (Tiptap) for editing contract content.
 * Designed for low digital literacy users with simple toolbar and French labels.
 *
 * Features:
 * - Word-like editing experience
 * - Copy/paste from MS Word (preserves formatting)
 * - Auto-save every 30 seconds
 * - Mobile-friendly
 * - Simple toolbar (bold, italic, headings, lists)
 */

'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useCallback, useState } from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Undo,
  Redo,
  Save,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ContractEditorProps {
  initialContent?: string;
  onSave?: (html: string) => void | Promise<void>;
  onChange?: (html: string) => void; // Called on every change (real-time)
  onEditorReady?: (getContent: () => string) => void; // Called when editor is ready, provides a function to get current content
  autoSave?: boolean;
  autoSaveInterval?: number; // in milliseconds
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}

export function ContractEditor({
  initialContent = '',
  onSave,
  onChange,
  onEditorReady,
  autoSave = true,
  autoSaveInterval = 30000, // 30 seconds
  placeholder = 'Collez ou écrivez le contenu du contrat ici...',
  className,
  readOnly = false,
}: ContractEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialContent,
    editable: !readOnly,
    onCreate: ({ editor }) => {
      // Provide a function to get current content on-demand
      if (onEditorReady) {
        onEditorReady(() => editor.getHTML());
      }
    },
    onUpdate: ({ editor }) => {
      setHasUnsavedChanges(true);
      // Call onChange callback with current HTML content
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
  });

  // Manual save function
  const handleSave = useCallback(async () => {
    if (!editor || !onSave) return;

    const html = editor.getHTML();
    setIsSaving(true);

    try {
      await onSave(html);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      toast.success('Contenu sauvegardé');
    } catch (error) {
      console.error('Error saving contract content:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  }, [editor, onSave]);

  // Auto-save effect
  useEffect(() => {
    if (!autoSave || !onSave || !hasUnsavedChanges) return;

    const timer = setTimeout(() => {
      handleSave();
    }, autoSaveInterval);

    return () => clearTimeout(timer);
  }, [autoSave, onSave, hasUnsavedChanges, autoSaveInterval, handleSave]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="border-b bg-muted/30 p-2 flex flex-wrap items-center gap-2">
        {/* Text Formatting */}
        <Button
          type="button"
          variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run() || readOnly}
          className="min-h-[44px] gap-2"
        >
          <Bold className="h-4 w-4" />
          <span className="text-sm">Gras</span>
        </Button>

        <Button
          type="button"
          variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run() || readOnly}
          className="min-h-[44px] gap-2"
        >
          <Italic className="h-4 w-4" />
          <span className="text-sm">Italique</span>
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Lists */}
        <Button
          type="button"
          variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={readOnly}
          className="min-h-[44px] gap-2"
        >
          <List className="h-4 w-4" />
          <span className="text-sm">Liste</span>
        </Button>

        <Button
          type="button"
          variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={readOnly}
          className="min-h-[44px] gap-2"
        >
          <ListOrdered className="h-4 w-4" />
          <span className="text-sm">Numéros</span>
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Undo/Redo */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run() || readOnly}
          className="min-h-[44px] gap-2"
        >
          <Undo className="h-4 w-4" />
          <span className="text-sm">Annuler</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run() || readOnly}
          className="min-h-[44px] gap-2"
        >
          <Redo className="h-4 w-4" />
          <span className="text-sm">Rétablir</span>
        </Button>

        <div className="flex-1" />

        {/* Auto-Save Status */}
        {onSave && (
          <div className="flex items-center gap-2">
            {isSaving ? (
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sauvegarde en cours...
              </span>
            ) : lastSaved ? (
              <span className="text-sm text-green-600 flex items-center gap-1">
                ✓ Sauvegardé automatiquement
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className={cn(
          'prose prose-sm max-w-none p-6 min-h-[600px] focus:outline-none',
          '[&_.ProseMirror]:min-h-[600px] [&_.ProseMirror]:outline-none',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0'
        )}
      />
    </div>
  );
}
