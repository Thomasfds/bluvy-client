import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { SeoService } from '../../core/services/seo.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [IonContent, IonIcon, TranslatePipe],
  templateUrl: './terms.page.html',
  styleUrls: ['./legal.scss'],
})
export class TermsPage {
  private location = inject(Location);
  protected i18n   = inject(TranslationService);

  constructor() {
    inject(SeoService).set({
      title:         'Conditions d\'utilisation',
      description:   'Conditions Générales d\'Utilisation de Bluvy Messenger, messagerie privée chiffrée E2E basée sur votre identité Bluesky.',
      canonicalPath: '/terms',
    });
  }

  goBack(): void { this.location.back(); }
}
