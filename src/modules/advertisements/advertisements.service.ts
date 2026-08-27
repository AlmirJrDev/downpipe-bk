import { advertisementsRepository, AdvertisementRow } from './advertisements.repository';

function toPublicAd(row: AdvertisementRow) {
  return {
    id: row.id,
    title: row.title,
    caption: row.caption,
    imageUrl: row.image_url,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
  };
}

export const advertisementsService = {
  async listActive(limit: number) {
    const rows = await advertisementsRepository.listActive(limit);
    return rows.map(toPublicAd);
  },
};
