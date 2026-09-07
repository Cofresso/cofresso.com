CREATE TYPE "public"."image_kind" AS ENUM('front', 'detail', 'lifestyle', 'packaging');--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text NOT NULL,
	"kind" "image_kind" NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_images_product_kind_key" UNIQUE("product_id","kind")
);
--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "hero_image_url" text;--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "hero_image_alt" text;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");