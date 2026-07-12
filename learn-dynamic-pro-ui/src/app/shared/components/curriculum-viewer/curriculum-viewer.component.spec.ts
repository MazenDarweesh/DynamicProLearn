import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CurriculumViewerComponent } from './curriculum-viewer.component';

describe('CurriculumViewerComponent', () => {
  let component: CurriculumViewerComponent;
  let fixture: ComponentFixture<CurriculumViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CurriculumViewerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CurriculumViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
