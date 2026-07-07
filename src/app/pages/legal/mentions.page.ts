import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { SeoService } from '../../core/services/seo.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';

@Component({
  selector: 'app-mentions',
  standalone: true,
  imports: [IonContent, IonIcon, TranslatePipe],
  templateUrl: './mentions.page.html',
  styleUrls: ['./legal.scss'],
})
export class MentionsPage {
  private location = inject(Location);
  protected i18n   = inject(TranslationService);

  constructor() {
    inject(SeoService).set({
      title:         'Mentions légales',
      description:   'Mentions légales de Bluvy Messenger — éditeur Thomasfds Apps, hébergement européen, propriété intellectuelle (LCEN).',
      canonicalPath: '/mentions',
    });
  }

  goBack(): void { this.location.back(); }
}
