import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  forwardRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import Quill from 'quill';
import { SecurityContext, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR
} from '@angular/forms';

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rich-text-editor.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true
    }
  ]
})
export class RichTextEditorComponent
  implements AfterViewInit, ControlValueAccessor {

  @ViewChild('editor', { static: true }) editorRef!: ElementRef;

  private quill!: Quill;
  private readonly sanitizer = inject(DomSanitizer);
  private pendingValue = '';
  private onChange = (value: string) => {};
  private onTouched = () => {};

  ngAfterViewInit(): void {

    this.quill = new Quill(this.editorRef.nativeElement, {
      theme: 'snow',
      placeholder: 'Write your article content...',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline'],
          [{ header: [1, 2, 3, false] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link'],
          ['clean']
        ]
      }
    });

    this.quill.on('text-change', () => {
      const html = this.editorRef.nativeElement
        .querySelector('.ql-editor').innerHTML;

      this.onChange(html);
    });
    this.writeValue(this.pendingValue);
  }

  writeValue(value: string): void {
    this.pendingValue = this.sanitizer.sanitize(SecurityContext.HTML, value || '') || '';
    if (this.quill) {
      this.quill.setContents(this.quill.clipboard.convert({ html: this.pendingValue }), 'silent');
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
}
