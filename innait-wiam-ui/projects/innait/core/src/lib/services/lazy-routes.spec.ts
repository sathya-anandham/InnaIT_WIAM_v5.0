describe('Lazy loading route verification', () => {
  it('login-portal routes should all use loadComponent', async () => {
    const { routes } = await import('../../../../../../login-portal/src/app/app.routes');
    for (const route of routes) {
      if (route.path !== '**' && !route.redirectTo) {
        expect(route.loadComponent).toBeDefined(`Route '${route.path}' should use lazy loading`);
      }
    }
  });

  it('self-service-portal routes should use lazy loaded children', async () => {
    const { routes } = await import('../../../../../../self-service-portal/src/app/app.routes');
    const parent = routes.find((r) => r.children);
    expect(parent).toBeTruthy('Should have a parent route with children');
    if (parent?.children) {
      for (const child of parent.children) {
        if (child.path && !child.redirectTo) {
          expect(child.loadComponent).toBeDefined(`Child route '${child.path}' should use lazy loading`);
        }
      }
    }
  });

  it('admin-console routes should use lazy loaded children', async () => {
    const { routes } = await import('../../../../../../admin-console/src/app/app.routes');
    const parent = routes.find((r) => r.children);
    expect(parent).toBeTruthy('Should have a parent route with children');
    if (parent?.children) {
      for (const child of parent.children) {
        if (child.path && !child.redirectTo) {
          expect(child.loadComponent).toBeDefined(`Child route '${child.path}' should use lazy loading`);
        }
      }
    }
  });
});
