const fs = require('fs'); 
let c = fs.readFileSync('src/app/features/admin/admin-testers/admin-testers.component.html', 'utf8'); 
c = c.replace('(click)="viewVersionProgress(v)">عرض التقدم</button>', '[routerLink]="[\'/admin/versions\', v.id]">إسناد وتفاصيل</button>'); 
fs.writeFileSync('src/app/features/admin/admin-testers/admin-testers.component.html', c);
