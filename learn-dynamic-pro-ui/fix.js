const fs = require('fs'); 
let f = fs.readFileSync('src/app/shared/components/curriculum-viewer/curriculum-viewer.component.html', 'utf8'); 
f = f.replace(/<td style="text-align: left; width: 30%;">\s*<\/td>/m, `<td style="text-align: left; width: 30%;">
                  <div class="d-flex gap-2" style="justify-content: flex-end; align-items: center;">
                    <button *ngIf="!lesson.isCompleted" class="btn-blue" style="padding: 6px 12px; font-size: 13px;" (click)="markLessonComplete(lesson.lessonId)">اكتمال</button>
                    <button *ngIf="lesson.isCompleted" class="btn-blue" style="padding: 6px 12px; font-size: 13px; background-color: var(--color-danger);" (click)="unmarkLessonComplete(lesson.lessonId)">إلغاء</button>
                  </div>
                </td>`); 
fs.writeFileSync('src/app/shared/components/curriculum-viewer/curriculum-viewer.component.html', f);
