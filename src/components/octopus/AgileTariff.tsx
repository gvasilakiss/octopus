"use client";

import { ReactNode, useContext, useEffect, useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { UserContext } from "@/context/user";
import BrushChart from "./BrushChart";
import PricePaneAgile from "./PricePaneAgile";
import Remark from "./Remark";
import TariffSelect from "./TariffSelect";
import MapChart from "@/components/octopus/MapChart";
import { AGILE, ITariffPlan, QueryProducts } from "@/data/source";
import PricePaneAgile2 from "./PricePaneAgile2";
import MapChartAgile from "./MapChartAgile";
import { WindowResizeContext } from "@/context/windowResize";
import { WindowVisibilityContext } from "@/context/windowVisibility";
import ElectricityForecast from "./ElectricityForecast";

const AgileTariff = () => {
  const [tariff, setTariff] = useState(AGILE[0].code);
  const [currentPeriod, setCurrentPeriod] = useState(new Date().toUTCString());
  const { value, setValue } = useContext(UserContext);
  useContext(WindowResizeContext);
  useContext(WindowVisibilityContext);

  const { gsp, agileCode } = value;

  const handleSelect = (selectValue: string) => {
    setTariff(selectValue);
    setValue({ ...value, agileCode: selectValue });
  };

  const AgilePlans = AGILE;

  return (
    <div className="lg:col-[content] my-4">
      <section className="my-4">
        <div className="flex items-center justify-center font-display">
          <div className="h-14 rounded-md px-3 py-2 ring-offset-background focus:outline-none [&amp;>h1>span]:line-clamp-1 [&amp;>span]:line-clamp-1 w-auto max-w-full text-[clamp(20px,7vw,80px)] text-accentBlue-400 flex items-center justify-center">
            <h1 className="overflow-hidden [&amp;>*]:whitespace-pre  [&amp;>*]:text-ellipsis  [&amp;>*]:overflow-hidden  [&amp;>*]:block! [&amp;>*]:max-w-full">
              <span>Agile Octopus Dec 2023 v1</span>
            </h1>
            <Remark variant="badge">
              <span className="text-accentPink-500 font-bold pr-2">
                Octopus has moved all Agile users to{" "}
                <span className="text-accentPink-500">
                  Agile Octopus Dec 2023
                </span>{" "}
                from 15Feb onwards.
              </span>
            </Remark>
          </div>
        </div>
      </section>
      <section className="flex flex-col md:flex-row items-stretch md:justify-center md:items-center gap-4 my-4">
        <PricePaneAgile
          tariff={tariff}
          type="E"
          gsp={gsp}
          setCurrentPeriod={setCurrentPeriod}
        />
        <BrushChart
          tariff={tariff}
          type="E"
          gsp={gsp}
          duration="2-days"
          height={300}
        />
      </section>
      <section className="flex flex-col md:flex-row items-stretch md:justify-center md:items-center gap-4 my-4 md:mt-8">
        <div className="flex-1">
          <div className="flex-1 text-lg font-bold text-center  text-accentPink-600">
            Today&apos;s rates
          </div>
          <PricePaneAgile2 tariff={tariff} type="E" gsp={gsp} />
        </div>
        <div className="flex-1">
          <div className="flex-1 text-lg font-bold text-center text-accentPink-600">
            Tomorrow&apos;s rates
          </div>
          <PricePaneAgile2
            tariff={tariff}
            type="E"
            gsp={gsp}
            date={new Date(
              new Date().setDate(new Date().getDate() + 1)
            ).toDateString()}
          />
        </div>
      </section>
      <ElectricityForecast standalone={true} />
      <div className="mt-6 flex-0 text-lg font-bold text-center translate-y-3 text-accentPink-600">
        Changes over the past month
      </div>
      <section className="flex justify-center items-center gap-4 my-4">
        <BrushChart tariff={tariff} type="E" gsp={gsp} />
      </section>
      <section className="flex flex-col md:flex-row items-stretch md:justify-center md:items-center gap-4 my-4 md:mt-8">
        <div className="flex-1">
          <div className="flex-1 text-lg font-bold text-center  text-accentPink-600">
            Regional unit rates
          </div>
          <MapChartAgile
            tariff={tariff}
            type="E"
            gsp={gsp}
            currentPeriod={currentPeriod}
          />
        </div>
        {!tariff.includes("OUTGOING") && (
          <div className="flex-1">
            <div className="flex-1 text-lg font-bold text-center  text-accentPink-600">
              Regional standing charges
            </div>
            <MapChart
              tariff={tariff}
              type="E"
              gsp={gsp}
              rate="standing_charge_inc_vat"
            />
          </div>
        )}
      </section>
      <h2 className="flex-0 text-lg font-bold text-center translate-y-3 text-accentPink-600">
        Octopus Agile Plans FAQ
      </h2>
      <section className="flex justify-center items-center gap-4 my-4 flex-col bg-black/30 rounded-xl p-4 lg:p-10">
        <h3 className="font-bold text-accentBlue-700">About Octopus Agile</h3>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-0a" className="border-b-accentBlue-900">
            <AccordionTrigger>
              I can only see the prices for electricity. Is there an Agile
              tariff for gas?
            </AccordionTrigger>
            <AccordionContent className="text-white/60">
              Regrettably NO.
              <br />
              <br />
              That is because generation of electricity is not that agile (puns
              intended) as generators will need to be working continually. The
              cost of electricity depends on the amount of demand vs supply at
              any given moment. When there is a high demand, the unit rate goes
              up. When there is a surplus, the unit rate goes down even to
              negative as storing excess electricity is costly and inefficient.
              It makes more sense to pay a small amount to customers to use up
              all the excess energy at that moment. But for gases, as they are
              already being stored in gas tanks, there are no extra costs if the
              short-term demand is low.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-0b" className="border-b-accentBlue-900">
            <AccordionTrigger>
              What have the Ofgem price caps to do with Agile?
            </AccordionTrigger>
            <AccordionContent className="text-white/60">
              {/*Nothing.
              <br />
              <br />
              Agile tariffs have a much higher price cap of 100p per unit set by
              Octopus than the Ofgem price caps as Agile is a new energy
              contract not protected by Ofgem caps. But the general trends of
              Ofgem price cap will give you a good idea of where the energy
              prices are heading in the near future.*/}
              Agile tariffs are variable tariffs protected by Ofgem energy caps.
              However, the capped amount is to be re-calculated for the overall
              cost of energy each month rather than limiting the maximum unit
              rate for any individual period.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-0c" className="border-b-accentBlue-900">
            <AccordionTrigger>
              I am currently on Octopus Tracker/Go/flexible/fixed. Will I save
              more by switching to Agile?
            </AccordionTrigger>
            <AccordionContent className="text-white/60">
              It depends.
              <br />
              <br />
              Whether or not getting more savings through Octopus Agile really
              depends heavily on your energy use pattern. If you can shift all
              your energy use to periods with the lowest unit rates, you can
              save up to 50% vs Ofgem price cap plans. To enjoy even more
              savings, some users have install batteries in their home to charge
              up during the cheapest periods and run on the batteries for the
              rest of the day. But remember energy price can go up or down
              suddenly. Do keep your eyes on the trends and take action if
              deemded appropriate.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-0d" className="border-b-accentBlue-900">
            <AccordionTrigger>
              Why do the unit rates different depending on where I live?
            </AccordionTrigger>
            <AccordionContent className="text-white/60">
              That is because Octopus needs to pay a different amount of
              operational cost (for maintaining and using the transmission
              network) to deliver energy to the users of different locations.
              This cost is passed onto the end users in order to keep the Agile
              price as low as possible. This is also the normal practices for
              energy companies.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <h3 className="font-bold text-accentBlue-700 mt-6">Joining Agile</h3>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1a" className="border-b-accentBlue-900">
            <AccordionTrigger>
              How long does it take to join the Octopus Agile tariff?
            </AccordionTrigger>
            <AccordionContent className="text-white/60">
              For current Octopus clients with smart meters, it is officially
              told to take around 2 weeks, though some managed to get response
              from Octopus within a few hours of signing up and switch over
              within a day or two. It will take longer if you are not currently
              an Octopus client or do not have a smart meters.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-1b" className="border-b-accentBlue-900">
            <AccordionTrigger>
              How do I sign up for the Octopus Agile tariff?
            </AccordionTrigger>
            <AccordionContent className="text-white/60">
              Head over to the{" "}
              <a href="https://octopus.energy/smart/agile/" target="_blank">
                Octopus Agile page
              </a>{" "}
              and sign up there.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-1c" className="border-b-accentBlue-900">
            <AccordionTrigger>
              What if I do not have a smart meter?
            </AccordionTrigger>
            <AccordionContent className="text-white/60">
              You can request to have a FREE smart meter installed by Octopus
              when you sign up at no costs to you. But the wait time is over 2
              weeks at the moment. Before installing the smart meter, you can
              choose to use the standard tariff, such as Flexible Octopus, until
              your smart meter is installed and running properly.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-1d" className="border-b-accentBlue-900">
            <AccordionTrigger>
              I have submitted my application for over 2 weeks but still have
              not heard from Octopus. What to do now?
            </AccordionTrigger>
            <AccordionContent className="text-white/60">
              According to experiences of Octopus users, sending emails to
              support may not be the optimal way to chase in this case. Sending
              messages on X is by far the most efficient way to get a response
              within a few hours. Seems they have dedicated advisers monitoring
              social media messages.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-1e" className="border-b-accentBlue-900">
            <AccordionTrigger>
              When is the best time to make the switch?
            </AccordionTrigger>
            <AccordionContent className="text-white/60">
              If you have done your planning and calculations and made up your
              mind to change your energy use pattern, you can make the switch
              right away to enjoy the savings brought to you by Agile tariff.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <h3 className="font-bold text-accentBlue-700 mt-6">Quitting Agile</h3>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-2a" className="border-b-accentBlue-900">
            <AccordionTrigger>
              Are there any penalties or exit fees for leaving Agile?
            </AccordionTrigger>
            <AccordionContent className="text-white/60">
              Absolutely NO.
              <br />
              <br />
              It will take a few days to switch over to any other Octopus
              tariffs. During this time, you will still be charged the original
              tariff. But if you switch away from Octopus, you may be able to
              switch faster depending on the processing time of your new energy
              provider.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2b" className="border-b-accentBlue-900">
            <AccordionTrigger>
              Can I switch to flexible plan in winter when the unit rate is high
              and back to Agile in spring?
            </AccordionTrigger>
            <AccordionContent className="text-white/60">
              Yes but that may not be advisible.
              <br />
              <br />
              Agile tariff is still way cheaper than the standard variable
              tariff around half of the period of each day even during winter
              months. Provided you can shift most of your energy use to the
              cheaper periods, it still saves you money on Agile.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
    </div>
  );
};

export default AgileTariff;
