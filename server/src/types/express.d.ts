import type { ProjectDocument } from '../models/Project';
import type { UserDocument } from '../models/User';
import type { IssueDocument } from '../models/Issue';
import type { ProjectRole } from '../constants/domain';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDocument;
      project?: ProjectDocument;
      projectRole?: ProjectRole;
      issue?: IssueDocument;
      validated: {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };
    }
  }
}

export {};
