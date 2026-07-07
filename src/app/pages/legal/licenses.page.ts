import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { SeoService } from '../../core/services/seo.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';

@Component({
  selector: 'app-licenses',
  standalone: true,
  imports: [IonContent, IonIcon, TranslatePipe],
  templateUrl: './licenses.page.html',
  styleUrls: ['./legal.scss'],
})
export class LicensesPage {
  private location = inject(Location);
  protected i18n   = inject(TranslationService);

  constructor() {
    inject(SeoService).set({
      title:         'Licences open source',
      description:   'Bibliothèques open source utilisées par Bluvy Messenger : Angular, Ionic, ts-mls, @atproto/api et bien d\'autres.',
      canonicalPath: '/licenses',
    });
  }

  goBack(): void { this.location.back(); }
}
