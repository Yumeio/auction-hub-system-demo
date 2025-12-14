import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { AuctionCard } from '@/components/auction/AuctionCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/api';
import type { SearchAuctionResult } from '@/api/types';
import { ArrowRight, Gavel, Users, Shield, Clock, Loader2 } from 'lucide-react';

export default function Home() {
  const [featuredAuctions, setFeaturedAuctions] = useState<SearchAuctionResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAuctions = async () => {
      try {
        const response = await apiClient.search.auctionsByQuery({ status: 'active', limit: 6 });
        setFeaturedAuctions(response.items || []);
      } catch (error) {
        console.error('Failed to fetch auctions:', error);
        setFeaturedAuctions([]); // Ensure empty array on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuctions();
  }, []);

  const features = [
    {
      icon: Gavel,
      title: 'Live Bidding',
      description: 'Experience real-time bidding with instant updates and competitive auctions.',
    },
    {
      icon: Shield,
      title: 'Secure Transactions',
      description: 'Your payments and personal data are protected with industry-leading security.',
    },
    {
      icon: Users,
      title: 'Trusted Community',
      description: 'Join thousands of verified buyers and sellers in our marketplace.',
    },
    {
      icon: Clock,
      title: 'Timed Auctions',
      description: 'Never miss a deadline with real-time countdowns and notifications.',
    },
  ];

  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-muted/50 to-background py-20 md:py-32">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4">
              Live Auctions Available Now
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Discover Unique Items at
              <span className="text-primary"> Unbeatable Prices</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8">
              Join our vibrant auction community. Bid on exclusive items, sell your treasures,
              and experience the thrill of winning.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/auctions">
                  Browse Auctions
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/register">Start Selling</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Auctions */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">Featured Auctions</h2>
              <p className="text-muted-foreground mt-1">Don't miss these exciting opportunities</p>
            </div>
            <Button variant="ghost" asChild>
              <Link to="/auctions">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : featuredAuctions?.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredAuctions.map((auction) => (
                <AuctionCard key={auction.auctionID} auction={auction} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Gavel className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active auctions at the moment. Check back soon!</p>
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Why Choose AuctionHub?</h2>
            <p className="text-muted-foreground">
              We've built a platform that makes buying and selling a breeze.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="text-center p-6 rounded-lg bg-background border hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center bg-primary rounded-2xl p-8 md:p-12 text-primary-foreground">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Start?</h2>
            <p className="text-primary-foreground/80 mb-8">
              Join thousands of users who are already buying and selling on AuctionHub.
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link to="/register">Create Free Account</Link>
            </Button>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}