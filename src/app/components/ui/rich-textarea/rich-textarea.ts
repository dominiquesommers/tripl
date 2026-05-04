import {
  Component, input, output, signal, computed,
  ElementRef, ViewChild, HostListener, ViewEncapsulation, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export type PatternType = 'url' | 'maps' | 'email' | 'whatsapp';
export type EditorState = 'idle' | 'waiting-for-paste';

export const PATTERN_CONFIG: Record<PatternType, {
  icon: string; color: string; shortcut: string; defaultLabel: string;
}> = {
  url:      { icon: 'link',           color: '#60a5fa', shortcut: '⌘k',  defaultLabel: 'link' },
  maps:     { icon: 'map-pin',        color: '#34d399', shortcut: '⌃⌘m', defaultLabel: 'location' },
  email:    { icon: 'mail',           color: '#f59e0b', shortcut: '⌃⌘e', defaultLabel: 'email' },
  whatsapp: { icon: 'message-circle', color: '#4ade80', shortcut: '⌃⌘w', defaultLabel: 'message' },
};

const makePatternRe = () => /(url|maps|email|whatsapp)\(([^)]+),\s*([^)]*)\)/g;

const MD_PATTERNS = [
  { re: /\*\*(.*?)\*\*/g, tag: 'strong', class: 'md-bold' },   // **Bold**
  { re: /__(.*?)__/g, tag: 'u', class: 'md-underline' },      // __Underline__
  { re: /~~(.*?)~~/g, tag: 'del', class: 'md-strike' },       // ~~Strike~~
  // { re: /_(.*?)_/g, tag: 'em', class: 'md-italic' },         // _Italic_
  { re: /(^|\s|>)_(?=\S)(.*?\S)_($|\s|<)/g, tag: 'em', class: 'md-italic' }, // _Italic_
];

@Component({
  selector: 'app-rich-textarea',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './rich-textarea.html',
  styleUrls: ['./rich-textarea.css'],
})
export class RichTextarea {

  private sanitizer = inject(DomSanitizer);

  // ── Inputs / Outputs ──────────────────────────────────────
  value = input<string>('');
  placeholder = input<string>('Add description...');
  multiline = input<boolean>(true);
  saveValue = output<string>();

  // ── State ─────────────────────────────────────────────────
  isFocused = signal(false);
  editorState = signal<EditorState>('idle');
  awaitingPatternType = signal<PatternType | null>(null);
  statusMessage = computed(() => this.getStatusMessage());

  private savedRange: Range | null = null;
  private pendingLabel: string = '';

  // ── Refs ──────────────────────────────────────────────────
  @ViewChild('editor') editorEl!: ElementRef<HTMLDivElement>;
  @ViewChild('wrapper') wrapperEl!: ElementRef<HTMLDivElement>;

  patternTypes: PatternType[] = ['url', 'maps', 'email', 'whatsapp'];
  config = PATTERN_CONFIG;

  // ── Display ───────────────────────────────────────────────
  displayHtml = computed((): SafeHtml =>
    this.sanitizer.bypassSecurityTrustHtml(this.renderToHtml(this.value()))
  );

  hasContent = computed(() => !!this.value()?.trim());

  // ── Status Message ────────────────────────────────────────

  private getStatusMessage(): string {
    const state = this.editorState();
    const type = this.awaitingPatternType();
    if (state === 'waiting-for-paste' && type) {
      return `Ready to paste ${type === 'url' ? 'URL' : type}`;
    }
    return '';
  }

  // ── Focus / Blur ──────────────────────────────────────────
  handleDisplayClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const link = target.closest('a.chip-link');
    if (link) {
      event.stopPropagation();
    } else {
      this.onEditorFocus();
    }
  }

  onEditorFocus() {
    if (!this.isFocused()) {
      this.isFocused.set(true);
      setTimeout(() => {
        if (this.editorEl) {
          this.editorEl.nativeElement.innerHTML = this.renderToEditorHtml(this.value());
          this.placeCursorAtEnd();
        }
      }, 0);
    }
  }

  onEditorBlur(event: FocusEvent) {
    // Check if focus moved to another element within the editor (like a label)
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (relatedTarget && this.editorEl.nativeElement.contains(relatedTarget)) {
      // Focus moved to a child element (like chip-label), don't blur
      return;
    }

    setTimeout(() => {
      this.isFocused.set(false);
      this.editorState.set('idle');
      this.awaitingPatternType.set(null);
      const raw = this.serializeEditor();
      this.saveValue.emit(raw.trimEnd());
    }, 150);
  }

  // ── Keyboard ──────────────────────────────────────────────

  onKeyDown(event: KeyboardEvent) {
    const meta = event.metaKey || event.ctrlKey;
    const shift = event.shiftKey;

    // Block formatting shortcuts: Ctrl/Cmd + B, I, U
    if (meta && !shift && (event.key === 'b' || event.key === 'i' || event.key === 'u' || event.key === 'x')) {
      event.preventDefault();
      const wrapper = event.key === 'b' ? '**' : event.key === 'u' ? '__' : event.key === 'x' ? '~~' : '_';
      this.wrapSelection(wrapper);
      return;
    }

    // Blur on Enter (single-line) or Shift+Enter (both modes)
    if (event.key === 'Enter' && (shift || !this.multiline())) {
      event.preventDefault();
      this.editorEl.nativeElement.blur();
      return;
    }

    // Cancel waiting state or blur altogether on Escape
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.editorState() === 'waiting-for-paste') {
        this.editorState.set('idle');
        this.awaitingPatternType.set(null);
      } else {
        this.editorEl.nativeElement.blur();
      }
      return;
    }

    if (meta && !shift && event.key === 'k') { event.preventDefault(); this.prepareChipInsertion('url'); }
    if (meta && shift && event.key === 'M') { event.preventDefault(); this.prepareChipInsertion('maps'); }
    if (meta && shift && event.key === 'E') { event.preventDefault(); this.prepareChipInsertion('email'); }
    if (meta && shift && event.key === 'W') { event.preventDefault(); this.prepareChipInsertion('whatsapp'); }
  }

  private wrapSelection(symbol: string) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const selectedText = range.toString();

    // Check if already wrapped to "unwrap" it (basic toggle)
    let newText = `${symbol}${selectedText}${symbol}`;
    if (selectedText.startsWith(symbol) && selectedText.endsWith(symbol)) {
      newText = selectedText.substring(symbol.length, selectedText.length - symbol.length);
    }

    range.deleteContents();
    range.insertNode(document.createTextNode(newText));
  }

  // ── Toolbar ───────────────────────────────────────────────

  onToolbarClick(type: PatternType, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setTimeout(() => this.prepareChipInsertion(type), 100);
  }

  // ── Prepare Chip Insertion (waiting for paste) ─────────────

  private prepareChipInsertion(type: PatternType) {
    const sel = window.getSelection();
    let label = this.config[type].defaultLabel;

    // If text is selected, use it as the label
    if (sel && !sel.isCollapsed) {
      label = sel.toString();
    }

    // Save the range for later insertion
    if (sel && sel.rangeCount > 0) {
      this.savedRange = sel.getRangeAt(0).cloneRange();
    } else {
      this.savedRange = null;
    }

    this.pendingLabel = label;
    this.awaitingPatternType.set(type);
    this.editorState.set('waiting-for-paste');
  }

  // ── Paste Handler ────────────────────────────────────────

  // // @HostListener('paste', ['$event'])
  // onPaste(event: ClipboardEvent) {
  //   event.preventDefault();
  //
  //   // Get plain text only, ignore HTML/styling
  //   const pastedText = event.clipboardData?.getData('text/plain') || '';
  //
  //   // If waiting for paste, handle as chip insertion
  //   if (this.editorState() === 'waiting-for-paste') {
  //     const patternType = this.awaitingPatternType();
  //     if (!pastedText || !patternType) return;
  //
  //     // Classify the pasted text
  //     const classifiedType = this.classifyPastedText(pastedText, patternType);
  //     const label = this.pendingLabel;
  //
  //     // Check for overlapping selection with existing chips
  //     if (!classifiedType) {
  //       console.log('Not a valid url', pastedText);
  //     } else {
  //       if (this.savedRange) {
  //         this.deleteOverlappingChips(this.savedRange);
  //         this.savedRange.deleteContents();
  //         this.savedRange.insertNode(this.buildChipElement(classifiedType, pastedText, label));
  //
  //         // Place cursor after chip
  //         const range = document.createRange();
  //         range.setStartAfter(this.editorEl.nativeElement.lastChild!);
  //         range.collapse(true);
  //         const sel = window.getSelection();
  //         sel?.removeAllRanges();
  //         sel?.addRange(range);
  //       } else {
  //         this.editorEl.nativeElement.appendChild(
  //           this.buildChipElement(classifiedType, pastedText, label)
  //         );
  //         this.placeCursorAtEnd();
  //       }
  //     }
  //
  //     this.savedRange = null;
  //     this.editorState.set('idle');
  //     this.awaitingPatternType.set(null);
  //     return;
  //   }
  //
  //   // Normal paste: insert plain text without formatting
  //   const sel = window.getSelection();
  //   if (!sel || sel.rangeCount === 0) return;
  //
  //   const range = sel.getRangeAt(0);
  //   range.deleteContents();
  //
  //   // Insert as plain text node (no HTML/styling)
  //   const textNode = document.createTextNode(pastedText);
  //   range.insertNode(textNode);
  //
  //   // Place cursor after inserted text
  //   range.setStartAfter(textNode);
  //   range.collapse(true);
  //   sel.removeAllRanges();
  //   sel.addRange(range);
  // }

  onPaste(event: ClipboardEvent) {
    const target = event.target as HTMLElement;

    // 1. If pasting directly into a chip label, handle it as plain text and STOP
    if (target.classList.contains('chip-label')) {
      event.preventDefault();
      event.stopPropagation();
      const text = event.clipboardData?.getData('text/plain') || '';
      document.execCommand('insertText', false, text);
      return;
    }

    // Prevent default for the main editor paste
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text/plain') || '';

    // 2. Handle Pattern Insertion
    if (this.editorState() === 'waiting-for-paste') {
      const patternType = this.awaitingPatternType();
      if (!pastedText || !patternType) return;

      const classifiedType = this.classifyPastedText(pastedText, patternType);
      const label = this.pendingLabel;

      if (classifiedType) {
        if (this.savedRange) {
          this.deleteOverlappingChips(this.savedRange);
          this.savedRange.deleteContents();
          const chip = this.buildChipElement(classifiedType, pastedText, label);
          this.savedRange.insertNode(chip);

          // Move cursor after the new chip
          const range = document.createRange();
          range.setStartAfter(chip);
          range.collapse(true);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        } else {
          this.editorEl.nativeElement.appendChild(
            this.buildChipElement(classifiedType, pastedText, label)
          );
          this.placeCursorAtEnd();
        }
      }

      this.savedRange = null;
      this.editorState.set('idle');
      this.awaitingPatternType.set(null);
      return; // Exit here so we don't fall into "Normal paste"
    }

    // 3. Normal Editor Paste (Plain Text Only)
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();

    const textNode = document.createTextNode(pastedText);
    range.insertNode(textNode);

    range.setStartAfter(textNode);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ── Classify Pasted Text ──────────────────────────────────

  private classifyPastedText(text: string, suggested: PatternType): PatternType | null {
    const trimmed = text.trim();

    // Maps: check first (before email) since maps URLs contain @
    if (/maps\.google|google\.com\/maps|maps\.app\.goo\.gl|@/i.test(trimmed) && /maps|directions|location|@/i.test(trimmed)) {
      return 'maps';
    }

    // Email pattern: simple email format (no http/maps keywords)
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && !/maps|http|goo\.gl|wa\.me/i.test(trimmed)) {
      return 'email';
    }

    // WhatsApp: phone-like pattern (digits with optional +, spaces, dashes)
    if (/^\+?[\d\s\-()]{7,}$/.test(trimmed)) return 'whatsapp';

    // URL: starts with http/https or has domain pattern
    if (/^https?:\/\/.+|^[a-z0-9]+\.[a-z]{2,}/i.test(trimmed)) return 'url';

    // Fallback to null
    return null;
  }

  // ── Delete Overlapping Chips ──────────────────────────────

  private deleteOverlappingChips(range: Range) {
    const sel = window.getSelection();
    if (!sel) return;

    // Find all chips that overlap with the selection
    const chips = Array.from(this.editorEl.nativeElement.querySelectorAll('[data-chip]'));
    chips.forEach(chip => {
      const chipRange = document.createRange();
      chipRange.selectNode(chip as Node);

      // Check if chip overlaps with selection
      if (range.compareBoundaryPoints(Range.START_TO_END, chipRange) > -1 &&
          range.compareBoundaryPoints(Range.END_TO_START, chipRange) < 1) {
        (chip as HTMLElement).remove();
      }
    });
  }

  // ── Build Chip Element ────────────────────────────────────

  private buildChipElement(type: PatternType, hidden: string, label: string): HTMLElement {
    const span = document.createElement('span');
    span.contentEditable = 'false';
    span.className = `chip chip-${type}`;
    span.dataset['chip'] = 'true';
    span.dataset['chipType'] = type;
    span.dataset['chipHidden'] = hidden;
    span.dataset['chipLabel'] = label;
    span.dataset['pattern'] = this.buildPatternString(type, hidden, label);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'chip-label';
    labelSpan.contentEditable = 'true';
    labelSpan.textContent = label;

    // When label text changes
    labelSpan.addEventListener('input', () => {
      const newLabel = labelSpan.textContent ?? '';
      span.dataset['chipLabel'] = newLabel;
      span.dataset['pattern'] = this.buildPatternString(type, hidden, newLabel);

      // Delete chip if label becomes empty
      if (newLabel === '') {
        span.remove();
      }
    });

    // When cursor at boundary of label, allow escape to adjacent editor
    labelSpan.addEventListener('keydown', (e: KeyboardEvent) => {
      const sel = window.getSelection();
      if (!sel || !sel.isCollapsed) return;

      const offset = sel.focusOffset;
      const textLength = labelSpan.textContent?.length ?? 0;

      // If at the start and pressing Left, place cursor before the chip
      if (e.key === 'ArrowLeft' && offset === 0) {
        e.preventDefault();
        const range = document.createRange();
        range.setStartBefore(span);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }

      // If at the end and pressing Right, place cursor after the chip
      if (e.key === 'ArrowRight' && offset === textLength) {
        e.preventDefault();
        const range = document.createRange();
        range.setStartAfter(span);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });

    span.appendChild(labelSpan);
    return span;
  }

  // ── Helpers ────────────────────────────────────────────────

  private buildPatternString(type: PatternType, hidden: string, label: string): string {
    // Strip commas from hidden value
    const cleanHidden = hidden.replace(/,/g, '').trim();
    return `${type}(${cleanHidden}, ${label})`;
  }

  // ── Serialization ──────────────────────────────────────────

  serializeEditor(): string {
    if (!this.editorEl) return this.value();

    const el = this.editorEl.nativeElement;
    let result = '';

    // We iterate through top-level nodes to preserve your custom chips
    el.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent;
      } else if (node instanceof HTMLElement) {
        if (node.dataset['pattern']) {
          result += node.dataset['pattern'];
        } else if (node.tagName === 'BR') {
          result += '\n';
        } else if (node.tagName === 'DIV') {
          // Recursively handle the inside of the div
          // (This handles text and chips inside the new line)
          result += '\n' + this.serializeNodeRecursive(node);
        } else {
          result += node.innerText;
        }
      }
    });

    // Clean up any double-newlines browsers might add
    return result.replace(/\n\n+/g, '\n').trimEnd();
  }

  private serializeNodeRecursive(parent: HTMLElement): string {
    let str = '';
    parent.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        str += node.textContent;
      } else if (node instanceof HTMLElement) {
        if (node.dataset['pattern']) {
          str += node.dataset['pattern'];
        } else if (node.tagName === 'BR') {
          str += '\n';
        } else {
          str += this.serializeNodeRecursive(node);
        }
      }
    });
    return str;
  }

  // ── Render: raw → editor HTML ──────────────────────────────

  renderToEditorHtml(raw: string): string {
    if (!raw) return '';

    // 1. Initial Escape and Newlines
    let html = this.esc(raw).replace(/\n/g, '<br>');

    // 2. Process Chips (Editor mode with contentEditable internal labels)
    const chipRe = makePatternRe();
    html = html.replace(chipRe, (match, type, hidden, label) => {
      return `<span contenteditable="false" class="chip chip-${type}" data-chip="true" data-chip-type="${type}" data-chip-hidden="${this.escAttr(hidden)}" data-chip-label="${this.escAttr(label)}" data-pattern="${this.escAttr(match)}"><span class="chip-label" contenteditable="true">${this.esc(label)}</span></span>`;
    });

    // 3. Process Markdown (Visual Syntax Highlighting)
    MD_PATTERNS.forEach(p => {
      // We wrap the whole thing in a styled span, but keep symbols visible
      html = html.replace(p.re, (m, content) => {
        const sym = m.startsWith('~~') ? '~~' : m.slice(0, 2).replace(/[a-zA-Z0-9 ]/g, m[0]);
        // Note: This logic assumes 2-char symbols like ** or __. Adjust for 1-char if needed.
        return `<span class="${p.class}"><span class="md-symbol">${m.slice(0, m.indexOf(content))}</span>${content}<span class="md-symbol">${m.slice(m.indexOf(content) + content.length)}</span></span>`;
      });
    });

    return html;
  }

  renderToEditorHtml2(raw: string): string {
    if (!raw) return '';
    let html = '';
    let lastIndex = 0;
    const re = makePatternRe();
    let match: RegExpExecArray | null;

    while ((match = re.exec(raw)) !== null) {
      const before = raw.slice(lastIndex, match.index);
      if (before) html += this.esc(before).replace(/\n/g, '<br>');

      const type = match[1] as PatternType;
      const hidden = match[2].trim();
      const label = match[3].trim();

      html += `<span contenteditable="false" class="chip chip-${type}" data-chip="true" data-chip-type="${type}" data-chip-hidden="${this.escAttr(hidden)}" data-chip-label="${this.escAttr(label)}" data-pattern="${this.escAttr(match[0])}"><span class="chip-label" contenteditable="true">${this.esc(label)}</span></span>`;
      lastIndex = match.index + match[0].length;
    }

    const after = raw.slice(lastIndex);
    if (after) html += this.esc(after).replace(/\n/g, '<br>');

    return html;
  }

  // ── Render: raw → display HTML (with clickable links) ───────

  renderToHtml(raw: string): string {
    if (!raw) return '';

    // 1. Initial Escape and Newlines
    let html = this.esc(raw).replace(/\n/g, '<br>');

    // 2. Process Chips (Your existing logic, now applied to the string)
    const chipRe = makePatternRe();
    html = html.replace(chipRe, (match, type, hidden, label) => {
      const href = this.toHref(type as PatternType, hidden);
      return `<a href="${this.escAttr(href)}" target="_blank" rel="noopener" class="chip chip-${type} chip-link"><span class="chip-label">${this.esc(label)}</span></a>`;
    });

    // 3. Process Markdown
    MD_PATTERNS.forEach(p => {
      html = html.replace(p.re, `<${p.tag} class="${p.class}">$1</${p.tag}>`);
    });

    return html;
  }

  renderToHtml2(raw: string): string {
    if (!raw) return '';
    let html = '';
    let lastIndex = 0;
    const re = makePatternRe();
    let match: RegExpExecArray | null;

    while ((match = re.exec(raw)) !== null) {
      const before = raw.slice(lastIndex, match.index);
      if (before) html += this.esc(before).replace(/\n/g, '<br>');

      const type = match[1] as PatternType;
      const hidden = match[2].trim();
      const label = match[3].trim();

      const href = this.toHref(type, hidden);
      html += `<a href="${this.escAttr(href)}" target="_blank" rel="noopener" class="chip chip-${type} chip-link" style="cursor: pointer"><span class="chip-label" style="cursor: pointer">${this.esc(label)}</span></a>`;
      lastIndex = match.index + match[0].length;
    }

    const after = raw.slice(lastIndex);
    if (after) html += this.esc(after).replace(/\n/g, '<br>');

    return html;
  }

  // ── URL/Link Generation ────────────────────────────────────

  private toHref(type: PatternType, hidden: string): string {
    switch (type) {
      case 'url': return hidden;
      case 'maps': return hidden;
      case 'email': return `mailto:${hidden}`;
      case 'whatsapp': return `https://wa.me/${hidden.replace(/\D/g, '')}`;
    }
  }

  // ── Cursor & Selection ─────────────────────────────────────

  private placeCursorAtEnd() {
    const el = this.editorEl?.nativeElement;
    if (!el) return;
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  // ── HTML Escaping ──────────────────────────────────────────

  private esc(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private escAttr(str: string): string {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}
