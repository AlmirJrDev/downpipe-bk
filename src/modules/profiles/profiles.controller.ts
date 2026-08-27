import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { storageService } from '@/shared/storage/storage.service';
import { STORAGE_BUCKETS } from '@/shared/storage/storage.constants';
import { profilesService } from './profiles.service';
import { profilesRepository } from './profiles.repository';
import { updateProfileSchema, usernameParamSchema } from './profiles.schema';

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const profile = await profilesService.getMe(req.user.id);
    sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const input = updateProfileSchema.parse(req.body);
    const profile = await profilesService.updateMe(req.user.id, input);
    sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
}

export async function getByUsername(req: Request, res: Response, next: NextFunction) {
  try {
    const { username } = usernameParamSchema.parse(req.params);
    const profile = await profilesService.getPublicProfile(username, req.user?.id);
    sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
}

export async function uploadAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();

    if (!req.file) {
      throw AppError.validation('Nenhum arquivo enviado. Use o campo "file" (multipart/form-data).');
    }

    const currentProfile = await profilesRepository.findById(req.user.id);

    const { publicUrl, path } = await storageService.uploadImage({
      bucket: STORAGE_BUCKETS.AVATARS,
      userId: req.user.id,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    const profile = await profilesService.updateMe(req.user.id, { avatarUrl: publicUrl });

    // Remove o avatar antigo (best-effort).
    if (currentProfile?.avatar_url) {
      const oldPath = storageService.extractPathFromPublicUrl(
        STORAGE_BUCKETS.AVATARS,
        currentProfile.avatar_url
      );
      if (oldPath && oldPath !== path) {
        await storageService.deleteImage(STORAGE_BUCKETS.AVATARS, oldPath);
      }
    }

    sendSuccess(res, profile);
  } catch (err) {
    next(err);
  }
}
