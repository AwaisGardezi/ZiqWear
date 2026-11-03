import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { cmsApi, productApi, categoryApi } from '../services/api';
import { CmsContent, Product, Category } from '../types';
import { ProductGrid, NewsletterForm } from './HomeComponents';
import { RailBand } from '../components/rail/RailBand';
import { usePageMeta } from '../hooks/usePageMeta';

export function Home() {
  const [heroSlides, setHeroSlides] = useState<CmsContent[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  usePageMeta({
    description: 'ZIQWEAR — Zenith In Quality Wear. Premium streetwear designed and made in Pakistan.',
    url: '/',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [homepage, newArrivalsRes, categoriesRes] = await Promise.all([
          cmsApi.getHomepage(),
          productApi.getAll({ newArrival: true, limit: 8 }),
          categoryApi.getAll(),
        ]);
        setHeroSlides((homepage.data.sections || []).filter((s: CmsContent) => s.type === 'hero'));
        setNewArrivals(newArrivalsRes.data.products || []);
        setCategories(categoriesRes.data.categories?.filter((c: Category) => !c.parentId) || []);
      } catch (error) { console.error('Failed to fetch homepage data:', error); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-gold-600 border-t-transparent"></div></div>;

  return (
    <>
      <HeroSection slides={heroSlides} />
      <NewArrivalsSection products={newArrivals} />
      <RailBand />
      <CategoriesSection categories={categories} />
      <NewsletterSection />
    </>
  );
}

function HeroSection({ slides }: { slides: CmsContent[] }) {
  return (
    <section className="relative min-h-screen flex items-center">
      <div className="absolute inset-0 overflow-hidden">
        {slides.map((slide) => (
          <div key={slide.key} className="absolute inset-0 transition-opacity duration-1000">
            {slide.content?.backgroundImage && <img src={slide.content.backgroundImage} alt={slide.title} className="w-full h-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/45 to-transparent" />
          </div>
        ))}
      </div>
      {/* dark island over the hero photo: every child gets an explicit light colour */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-20 text-on-dark">
        <div className="max-w-3xl">
          {slides[0] && (
            <>
              <p className="font-ui uppercase tracking-widest text-xs text-gold-300 mb-4">{slides[0].content?.eyebrow || 'New Drop'}</p>
              <h1 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-on-dark mb-4">{slides[0].title}</h1>
              <p className="text-body text-on-dark/90 text-lg mb-8 max-w-xl">{slides[0].content?.subtitle}</p>
              <div className="flex flex-wrap gap-4"><Link to={slides[0].content?.ctaLink || '/shop'} className="btn btn-primary">Shop Now</Link><Link to="/collections" className="btn btn-outline text-on-dark border-[#d9b878]/60 hover:bg-brass hover:text-[#faf7f1]">Explore Collection</Link></div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function NewArrivalsSection({ products }: { products: Product[] }) {
  return (
    <section className="section">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-12"><div><p className="font-ui uppercase tracking-widest text-xs text-brass-dark mb-2">New Arrivals</p><h2 className="heading-2">Latest Drops</h2></div><Link to="/shop?newArrival=true" className="btn btn-ghost text-sm">View All</Link></div>
        <ProductGrid products={products} />
      </div>
    </section>
  );
}

function CategoriesSection({ categories }: { categories: Category[] }) {
  return (
    <section className="section">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12"><p className="font-ui uppercase tracking-widest text-xs text-brass-dark mb-2">Shop by Category</p><h2 className="heading-2">Explore Our Range</h2></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.slice(0, 5).map((category) => (
            <Link key={category.id} to={`/shop/${category.slug}`} className="group relative aspect-square overflow-hidden">
              {category.image && <img src={category.image} alt={category.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/85 to-transparent" />
              {/* dark scrim island: explicit light text */}
              <div className="absolute bottom-0 left-0 right-0 p-6 text-on-dark"><h3 className="font-medium text-lg text-on-dark">{category.name}</h3><p className="text-sm text-dark-300 mt-1">{category._count?.products || 0} products</p></div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function NewsletterSection() {
  return (
    <section className="section bg-cream">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <p className="font-ui uppercase tracking-widest text-xs text-brass mb-2">Stay Updated</p>
          <h2 className="heading-2 mb-4">Join the ZIQWEAR Club</h2>
          <p className="text-body mb-8">Get early access to drops, exclusive offers, and style inspiration.</p>
          <NewsletterForm />
        </div>
      </div>
    </section>
  );
}