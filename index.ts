import { Application, Router, send } from "https://deno.land/x/oak@v12.1.0/mod.ts";
import { Handlebars } from "https://deno.land/x/handlebars@v0.9.0/mod.ts";
import { existsSync } from "https://deno.land/std@0.179.0/fs/mod.ts";
import { Marked } from "https://raw.githubusercontent.com/meSingh/markdown/v3.0.0/mod.ts";

const AIRTABLE_KEY = Deno.env.get("AIRTABLE_KEY");

const app = new Application();
const handle = new Handlebars();
// by default uses this config:
// const DEFAULT_HANDLEBARS_CONFIG: HandlebarsConfig = {
//   baseDir: "views",
//   extname: ".hbs",
//   layoutsDir: "layouts/",
//   partialsDir: "partials/",
//   defaultLayout: "main",
//   helpers: undefined,
//   compilerOptions: undefined,
// };

// Logger
app.use(async (ctx: any, next: any) => {
  await next();
  const rt = ctx.response.headers.get("X-Response-Time");
  console.log(`${ctx.request.method} ${ctx.request.url} - ${rt}`);
});

// Timing
app.use(async (ctx: any, next: any) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.response.headers.set("X-Response-Time", `${ms}ms`);
});

const router = new Router();
router
  .get("/", async (context: any) => {
    let projects: any[] = [];
    const res = await fetch(
      "https://api.airtable.com/v0/appDmsiM7p756BLff/projects?maxRecords=100&view=published",
      {
        headers: {
          "Authorization": `Bearer ${AIRTABLE_KEY}`,
        },
      },
    );

    const records = await res.json();
    projects = projects.concat(records.records);

    context.response.body = await handle.renderView(
      "index",
      { projects: projects.reverse() },
    );
  })
  .get("/project/:id", async (context: any) => {
    if (context.params && context.params.id) {
      const res = await fetch(
        `https://api.airtable.com/v0/appDmsiM7p756BLff/projects?maxRecords=100&view=published&filterByFormula={slug}="${context.params.id}"`,
        // `https://api.airtable.com/v0/appDmsiM7p756BLff/projects/${context.params.id}`,
        {
          headers: {
            "Authorization": `Bearer ${AIRTABLE_KEY}`,
          },
        },
      );

      const projects = await res.json();
      const project = projects.records[0];

      if (project.fields.description_long) {
        project.fields.description_long = Marked.parse(
          project.fields.description_long,
        );
      }

      project.fields.description_encoded = encodeURIComponent(
        project.fields.description,
      );
      context.response.body = await handle.renderView(
        "project",
        { project },
      );
    }
  });

// Listen to server events
app.addEventListener("listen", ({ hostname, port, secure }: any) => {
  console.log(
    `Listening on: ${secure ? "https://" : "http://"}${hostname ??
      "localhost"}:${port}`,
  );
});

// Listen to server errors
app.addEventListener("error", (evt) => {
  // Will log the thrown error to the console.
  console.log(evt.error);
});

app.use(router.routes());
app.use(router.allowedMethods());

// Serve static content
app.use(async (context, next) => {
  try {
    await context.send({ root: `${Deno.cwd()}/static` });
  } catch {
    await next();
  }
});

const DEFAULT_PORT = 8000;
const envPort = Deno.env.get("PORT");
const port = envPort ? Number(envPort) : DEFAULT_PORT;


await app.listen({ port });
