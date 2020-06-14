import { Application, Router, send } from "https://deno.land/x/oak/mod.ts";
import { Handlebars } from "https://deno.land/x/handlebars/mod.ts";
import { existsSync } from "https://deno.land/std/fs/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";
import { Marked } from "https://deno.land/x/markdown/mod.ts";

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
          "Authorization": `Bearer ${config().AIRTABLE_KEY}`,
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
            "Authorization": `Bearer ${config().AIRTABLE_KEY}`,
          },
        },
      );

      const projects = await res.json();

      console.log(projects);

      if (projects.records[0].fields.description_long) {
        projects.records[0].fields.description_long = Marked.parse(
          projects.records[0].fields.description_long,
        );
      }

      context.response.body = await handle.renderView(
        "project",
        { project: projects.records[0] },
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
app.use(async (context) => {
  if (existsSync(`${Deno.cwd()}/static/${context.request.url.pathname}`)) {
    await send(context, context.request.url.pathname, {
      root: `${Deno.cwd()}/static`,
      // index: "index.html",
    });
  } else {
    console.log(
      `FILE DOEST NOT EXIST: ${context.request.method} ${context.request.url}`,
    );
  }
});

await app.listen({ port: 8000 });
