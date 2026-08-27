import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '@/shared/utils/apiResponse';
import { parsePagination, buildPaginationMeta } from '@/shared/middleware/pagination.middleware';
import { vehicleCatalogService } from './vehicle-catalog.service';
import {
  brandIdParamSchema,
  modelIdParamSchema,
  uuidParamSchema,
  searchQuerySchema,
} from './vehicle-catalog.schema';

export async function listBrands(_req: Request, res: Response, next: NextFunction) {
  try {
    const brands = await vehicleCatalogService.listBrands();
    sendSuccess(res, brands);
  } catch (err) {
    next(err);
  }
}

export async function listModelsByBrand(req: Request, res: Response, next: NextFunction) {
  try {
    const { brandId } = brandIdParamSchema.parse(req.params);
    const models = await vehicleCatalogService.listModelsByBrand(brandId);
    sendSuccess(res, models);
  } catch (err) {
    next(err);
  }
}

export async function listYearsByModel(req: Request, res: Response, next: NextFunction) {
  try {
    const { modelId } = modelIdParamSchema.parse(req.params);
    const years = await vehicleCatalogService.listYearsByModel(modelId);
    sendSuccess(res, years);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = uuidParamSchema.parse(req.params);
    const vehicle = await vehicleCatalogService.getById(id);
    sendSuccess(res, vehicle);
  } catch (err) {
    next(err);
  }
}

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const { q } = searchQuerySchema.parse(req.query);
    const pagination = parsePagination(req);

    const { results, total } = await vehicleCatalogService.search(q, pagination);

    sendPaginated(res, results, buildPaginationMeta(pagination.page, pagination.limit, total));
  } catch (err) {
    next(err);
  }
}
