# Activity Logs Implementation TODO

## Backend
- [x] 1. Add `activity_logs` table to `backend/src/config/migrate.sql`
- [x] 2. Create `backend/src/modules/activity-logs/` module (schema.ts, repository.ts, service.ts, controller.ts, routes.ts)
- [ ] 3. Create `backend/src/utils/activityLogger.ts` util
- [x] 4. Integrate `logActivity` calls in controllers:
  - [x] auth.controller.ts (login)
  - [ ] articles.controller.ts (CRUD)
  - [ ] applications.controller.ts (CRUD)
  - [ ] special-issues.controller.ts (CRUD)
  - [ ] staff.controller.ts (CRUD)
  - [ ] users.controller.ts (CRUD)
- [ ] 5. Add activity-log routes to `backend/src/routes/index.ts`

## Frontend
- [ ] 6. Add `/admin/logs` route to `frontend/ParagonWebApp/src/app/app.routes.ts`
- [ ] 7. Create `frontend/ParagonWebApp/src/app/features/admin/logs/activity-logs.{ts,html,scss}` + service + model
- [ ] 8. Update `maintenance-settings.service.ts` clearLogs() impl

## Testing
- [ ] 9. Migrate DB, test backend endpoints
- [ ] 10. Test frontend page renders logs, filters work

**Next Steps:**
1. Create `backend/src/utils/activityLogger.ts`
2. Update controllers with logActivity calls (one-by-one)
3. Add routes to index.ts

Updated: $(date)
