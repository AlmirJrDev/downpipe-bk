import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '@/shared/utils/apiResponse';
import { AppError } from '@/shared/utils/AppError';
import { parsePagination, buildPaginationMeta } from '@/shared/middleware/pagination.middleware';
import { usernameParamSchema } from '@/modules/profiles/profiles.schema';
import { carsService } from './cars.service';
import { carStatisticsService } from './car-statistics.service';
import { createCarSchema, updateCarSchema, carIdParamSchema, listCarsQuerySchema } from './cars.schema';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = listCarsQuerySchema.parse(req.query);
    const pagination = parsePagination(req);

    const { cars, total } = await carsService.list(filters, pagination);

    sendPaginated(res, cars, buildPaginationMeta(pagination.page, pagination.limit, total));
  } catch (err) {
    next(err);
  }
}

export async function listByUsername(req: Request, res: Response, next: NextFunction) {
  try {
    const { username } = usernameParamSchema.parse(req.params);
    const pagination = parsePagination(req);

    const { cars, total } = await carsService.listByUsername(username, pagination);

    sendPaginated(res, cars, buildPaginationMeta(pagination.page, pagination.limit, total));
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = carIdParamSchema.parse(req.params);
    const car = await carsService.getById(id);
    sendSuccess(res, car);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const input = createCarSchema.parse(req.body);
    const car = await carsService.create(req.user.id, input);
    sendSuccess(res, car, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = carIdParamSchema.parse(req.params);
    const input = updateCarSchema.parse(req.body);
    const car = await carsService.update(id, req.user.id, input);
    sendSuccess(res, car);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = carIdParamSchema.parse(req.params);
    await carsService.remove(id, req.user.id);
    sendSuccess(res, { success: true });
  } catch (err) {
    next(err);
  }
}

export async function uploadPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { id } = carIdParamSchema.parse(req.params);

    if (!req.file) {
      throw AppError.validation('Nenhum arquivo enviado. Use o campo "file" (multipart/form-data).');
    }

    const car = await carsService.uploadPhoto(id, req.user.id, {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
    });

    sendSuccess(res, car);
  } catch (err) {
    next(err);
  }
}

export async function getStatistics(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = carIdParamSchema.parse(req.params);
    const statistics = await carStatisticsService.getByCarId(id);
    sendSuccess(res, statistics);
  } catch (err) {
    next(err);
  }
}
